import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateRequiredFields } from "../utils/helpers.js";

export const createTeamInvitation = asyncHandler(async (req, res) => {
    validateRequiredFields(req.body, ['team_id', 'email', 'role', 'invited_by']);
    const { team_id, user_id, role, invited_by } = req.body;

    const { error } = await supabase
        .from('team_invitations')
        .insert({
            team_id: teamId,
            email: email.toLowerCase(),
            role,
            invited_by: invitedBy,
            expires_at: expiresAt.toISOString(),
            token,
            status: 'pending'
        })

    if (error) {
        throw new ApiError(error.status, error.message);
    }

    res.status(201).json(new ApiResponse(201, null, 'Team member invited successfully'));
});
