import { supabaseAdmin } from "@/config/supabaseAdmin";
import { getValidInvitationByToken } from "@/lib/invitations";
import { checkIfUserIsTeamMember } from "@/lib/teamMembers";
import { createUserWithEmailAndPassword, getUserByEmail } from "@/lib/userService";
import { ApiError } from "@/utils/ApiError";
import ApiResponse from "@/utils/ApiResponse";
import { asyncHandler } from "@/utils/asyncHandler";
import { generateExpiryDate, generateToken, validateRequiredFields } from "@/utils/helpers";
import { Request, Response } from "express";

export const createTeamInvitation = asyncHandler(async (req: Request, res: Response) => {
    const { team_id, email } = req.body
    //  Lookup user by email
    const { data: user, error: userError } = await req.supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

    if (userError) {
        throw new ApiError(500, userError.message);
    }
    // Check if the user is already a team member
    await checkIfUserIsTeamMember({
        supabase: req.supabase,
        teamId: team_id,
        userId: user.id,
    });

    // Check if invite already exists
    const { data: existingInvite } = await req.supabase
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

    const { error } = await req.supabase
        .from('team_invitations')
        .insert({
            ...req.body,
            expires_at: expiresAt,
            token,
            status: 'pending'
        })

    if (error) {
        throw new ApiError(500, error.message);
    }

    res.status(201).json(new ApiResponse(201, undefined, `Invitation sent to ${email}`));
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

        user = await createUserWithEmailAndPassword(req.body);
    }

    // Check if the user is already a team member
    await checkIfUserIsTeamMember({
        supabase: req.supabase,
        teamId: invitation.team_id,
        userId: user.id,
    });

    // Step 3: Add user to team_members 
    const { error: insertError } = await req.supabase
        .from('team_members')
        .insert({
            team_id: invitation.team_id,
            user_id: user.id,
            role: invitation.role,
            invited_by: invitation.invited_by,
        });

    if (insertError) {
        throw new ApiError(500, insertError.message);
    }

    // Mark invite as accepted
    await req.supabase
        .from('team_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitation.id);

    res.status(200).json(new ApiResponse(200, null, 'Invitation accepted successfully'));
});
