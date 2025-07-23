import { supabaseAdmin } from "@/config/supabaseAdmin";
import { getValidInvitationByToken } from "@/lib/invitations";
import { sendInvitationEmail } from "@/lib/mailer/nodeMailer";
import { addTeamMember, checkIfUserIsTeamMember } from "@/lib/teamMembers";
import { TeamInvitation } from "@/lib/types/teamInvitations";
import { createUserWithEmailAndPassword, getUserByEmail } from "@/lib/userService";
import { ApiError } from "@/utils/ApiError";
import ApiResponse from "@/utils/ApiResponse";
import { asyncHandler } from "@/utils/asyncHandler";
import { generateExpiryDate, generateToken, validateRequiredFields } from "@/utils/helpers";
import { Request, Response } from "express";

export const createTeamInvitation = asyncHandler(async (req: Request, res: Response) => {
    const { invitation_type, ...insertData } = req.body;
    const { team_id, email, role } = insertData

    //  Lookup user by email
    const user = await getUserByEmail(email);

    if (user) {
        // Check if the user is already a team member
        await checkIfUserIsTeamMember({
            supabase: req.supabase,
            team_id,
            user_id: user.id,
        });
    }

    // Check if invite already exists
    const { data: existingInvite, error: invite } = await supabaseAdmin
        .from('team_invitations')
        .select('id')
        .eq('team_id', team_id)
        .eq('email', email)
        .eq('status', 'pending')
        .maybeSingle();

    if (existingInvite) {
        throw new ApiError(400, 'User has already been invited to this team');
    }

    validateRequiredFields(req.body, ['team_id', 'email', 'role', 'invited_by']);

    const token = generateToken();
    const expiresAt = generateExpiryDate(7);

    const { data: invitation, error } = await supabaseAdmin
        .from('team_invitations')
        .insert({
            ...insertData,
            invited_at: new Date().toISOString(),
            expires_at: expiresAt,
            token,
            status: 'pending'
        })
        .select()
        .single();

    if (error) {
        throw new ApiError(500, error.message);
    }

    await sendInvitationEmail({ email, token, role, invitation_type });

    res.status(201).json(new ApiResponse(201, invitation, `Invitation sent to ${email}`));
});


export const getTeamInvitationByToken = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params

    const invitation = await getValidInvitationByToken(token);

    // Fetch team name & inviter full name
    const { data: team } = await supabaseAdmin
        .from('teams')
        .select('name')
        .eq('id', invitation.team_id)
        .single();

    const { data: inviter } = await supabaseAdmin
        .from('users')
        .select('full_name')
        .eq('id', invitation.invited_by)
        .single();

    // Check if a user with this email already exists
    const user = await getUserByEmail(invitation.email);

    if (user) {
        // Check if the user is already a team member
        await checkIfUserIsTeamMember({
            supabase: supabaseAdmin,
            team_id: invitation.team_id,
            user_id: user.id,
        });
    }

    const invitationData = {
        id: invitation.id,
        email: invitation.email,
        team_name: team?.name,
        invited_by: inviter?.full_name,
        alreadyRegistered: !!user
    }
    res.status(200).json(new ApiResponse(200, invitationData));
});

export const acceptTeamInvitation = asyncHandler(async (req: Request, res: Response) => {
    const token = req.params.token;

    const invitation = await getValidInvitationByToken(token);

    // Check if a user with this email already exists
    let user = await getUserByEmail(invitation.email);

    // If user doesn't exist, register them
    if (!user) {
        validateRequiredFields(req.body, ['firstName', 'lastName', 'email', 'password']);

        if (invitation.email !== req.body.email) {
            throw new ApiError(400, 'Email does not match the invitation');
        }

        user = await createUserWithEmailAndPassword({ ...req.body, role: invitation.role });
    }

    // Check if the user is already a team member
    await checkIfUserIsTeamMember({
        team_id: invitation.team_id,
        user_id: user.id,
    });

    // Add user to team_members 
    await addTeamMember({
        supabase: supabaseAdmin,
        team_id: invitation.team_id,
        user_id: user.id,
        role: invitation.role,
        invited_by: invitation.invited_by,
        invited_at: invitation.invited_at
    })
    // Mark invite as accepted
    const { error: updateError } = await supabaseAdmin
        .from('team_invitations')
        .update({
            status: 'accepted',
            accepted_at: new Date().toISOString()
        })
        .eq('id', invitation.id)
        .eq('token', token);

    if (updateError) {
        throw new ApiError(400, updateError.message);
    }

    res.status(200).json(new ApiResponse(200, null, 'Invitation accepted successfully'));
});

/* Decline Team invitation */
export const declineTeamInvitation = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    const invitation = await getValidInvitationByToken(token);

    const { error } = await supabaseAdmin
        .from('team_invitations')
        .update({
            status: 'declined',
            declined_at: new Date().toISOString()
        })
        .eq('id', invitation.id);

    if (error) throw new ApiError(500, error.message);

    res.status(200).json(new ApiResponse(200, { message: "Invitation declined." }));
});

/* Get all pending invitations */
export const getPendingInvitations = asyncHandler(async (req: Request, res: Response) => {
    const { team_id } = req.params

    const { data: invitations, error: invitationsError } = await supabaseAdmin
        .from('team_invitations')
        .select('*')
        .eq('team_id', team_id)
        .eq('status', 'pending')
        .gte('expires_at', new Date().toISOString());

    if (invitationsError) {
        throw new ApiError(500, invitationsError.message);
    }

    const pendingInvitations: TeamInvitation[] = invitations?.map(inv => ({
        id: inv.id,
        team_id: inv.team_id,
        email: inv.email,
        role: inv.role,
        token: inv.token,
        invited_by: inv.invited_by,
        invited_at: inv.invited_at,
        expires_at: inv.expires_at,
        status: inv.status
    })) || [];

    res.status(200).json(new ApiResponse(200, pendingInvitations));
});