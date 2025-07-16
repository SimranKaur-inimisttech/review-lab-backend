import { ApiError } from "@/utils/ApiError";
import ApiResponse from "@/utils/ApiResponse";
import { asyncHandler } from "@/utils/asyncHandler";
import { generateExpiryDate, generateToken, validateRequiredFields } from "@/utils/helpers";
import { Request, Response } from "express";

export const createTeamInvitation = asyncHandler(async (req: Request, res: Response) => {
    validateRequiredFields(req.body, ['team_id', 'email', 'role', 'invited_by']);

    const { email } = req.body
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
