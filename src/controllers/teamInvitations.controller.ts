import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateExpiryDate, generateToken, validateRequiredFields } from "../utils/helpers.js";

export const createTeamInvitation = asyncHandler(async (req, res) => {
    validateRequiredFields(req.body, ['team_id', 'email', 'role', 'invited_by']);

    const { email } = req.body
    const token = generateToken();
    const expiresAt = generateExpiryDate(7);

    const { error } = await supabase
        .from('team_invitations')
        .insert({
            ...req.body,
            expires_at: expiresAt,
            token,
            status: 'pending'
        })

    if (error) {
        throw new ApiError(error.status, error.message);
    }

    res.status(201).json(new ApiResponse(201, null, `Invitation sent to ${email}`));
});
