import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const inviteTeamMember = asyncHandler(async (req, res) => {
  const { team_id, user_id, role, invited_by } = req.body;

  const { data, error } = await req.supabase
    .from('team_members')
    .insert({
      team_id,
      user_id,
      role,
      invited_by
    })
    // .select(`
    //   *,
    //   users!team_members_user_id_fkey (
    //     id, 
    //     email, 
    //     full_name, 
    //     avatar_url
    //   )
    // `)
    // .single();

  if (error) {
    throw new ApiError(error.status, error.message);
  }

  res.status(201).json(new ApiResponse(201, data, 'Team member invited successfully'));
});
