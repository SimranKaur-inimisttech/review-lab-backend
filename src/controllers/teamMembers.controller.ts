import { addTeamMember, getTeamMembersbyId } from "@/lib/teamMembers";
import { AccountTeamMember } from "@/lib/types/teamMember";
import ApiResponse from "@/utils/ApiResponse";
import { asyncHandler } from "@/utils/asyncHandler";
import { validateRequiredFields } from "@/utils/helpers";
import { Request, Response } from "express";

export const inviteTeamMember = asyncHandler(async (req: Request, res: Response) => {
  validateRequiredFields(req.body, ['team_id', 'user_id', 'role', 'invited_by']);

  await addTeamMember({ ...req.body, supabase: req.supabase })

  res.status(201).json(new ApiResponse(201, undefined, 'Team member invited successfully'));
});

export const getAccountTeamMembers = asyncHandler(async (req: Request, res: Response) => {
  const { team_id } =req.params;

  const { data: membersData, success } = await getTeamMembersbyId(team_id) as {
    data: any[] | undefined;
    success: boolean
  };

  let currentUser = {
    id: userId,
    email: "admin@example.com",
    name: "Current User",
    role: "admin",
    status: "active",
    joinedAt: new Date().toISOString(),
    lastActive: new Date().toISOString()
  };

  // Fall back to current user as admin
  if (!success) {
    return {
      data: [currentUser],
      error: null
    };
  }
  const members: AccountTeamMember[] = membersData?.map(member => {
    // Handle the users join data properly
    const userData = Array.isArray(member.users) ? member.users[0] : member.users;
    return {
      id: member.user_id,
      email: userData?.email || 'unknown@example.com',
      name: userData?.full_name || 'Unknown User',
      role: member.role as 'admin' | 'member',
      status: 'active' as const,
      joinedAt: member.joined_at,
      lastActive: new Date().toISOString()
    };
  }) || [];

  // Always include the current user as admin if not already in the list
  const currentUserExists = members.some(m => m.id === userId);
  if (!currentUserExists) {
    members.unshift(currentUser);
  }

  res.status(201).json(new ApiResponse(201, undefined, 'Team member invited successfully'));
});