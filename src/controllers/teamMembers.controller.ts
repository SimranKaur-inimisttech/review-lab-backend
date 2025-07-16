import { ApiError } from "@/utils/ApiError";
import ApiResponse from "@/utils/ApiResponse";
import { asyncHandler } from "@/utils/asyncHandler";
import { validateRequiredFields } from "@/utils/helpers";
import { Request, Response } from "express";

export const inviteTeamMember = asyncHandler(async (req:Request, res:Response) => {
  validateRequiredFields(req.body, ['team_id', 'user_id', 'role', 'invited_by']);
 
  const { error } = await req.supabase
    .from('team_members')
    .insert(req.body);

  if (error) {
    throw new ApiError(500, error.message);
  }

  res.status(201).json(new ApiResponse(201, undefined, 'Team member invited successfully'));
});
