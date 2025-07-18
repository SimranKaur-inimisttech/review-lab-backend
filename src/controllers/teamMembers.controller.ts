import { addTeamMember } from "@/lib/teamMembers";
import ApiResponse from "@/utils/ApiResponse";
import { asyncHandler } from "@/utils/asyncHandler";
import { validateRequiredFields } from "@/utils/helpers";
import { Request, Response } from "express";

export const inviteTeamMember = asyncHandler(async (req: Request, res: Response) => {
  validateRequiredFields(req.body, ['team_id', 'user_id', 'role', 'invited_by']);

  await addTeamMember({ ...req.body, supabase: req.supabase })

  res.status(201).json(new ApiResponse(201, undefined, 'Team member invited successfully'));
});
