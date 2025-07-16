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
    const { data: existingMember } = await req.supabase
        .from('team_members')
        .select('id')
        .eq('team_id', team_id)
        .eq('user_id', user.id)
        .single();

    if (existingMember) {
        throw new ApiError(400, 'User is already a member of the team');
    }
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
