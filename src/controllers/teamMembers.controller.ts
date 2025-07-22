import { addTeamMember, getTeamMembersbyId } from "@/lib/teamMembers";
import { AccountTeamMember } from "@/lib/types/teamMember";
import ApiResponse from "@/utils/ApiResponse";
import { asyncHandler } from "@/utils/asyncHandler";
import { validateRequiredFields } from "@/utils/helpers";
import { User } from "@supabase/supabase-js";
import { Request, Response } from "express";

export const inviteTeamMember = asyncHandler(async (req: Request, res: Response) => {
  validateRequiredFields(req.body, ['team_id', 'user_id', 'role', 'invited_by']);

  await addTeamMember({ ...req.body, supabase: req.supabase })

  res.status(201).json(new ApiResponse(201, undefined, 'Team member invited successfully'));
});

export const getAccountTeamMembers = asyncHandler(async (req: Request, res: Response) => {
  const { team_id } = req.params;
  const { id, email, role, user_metadata: { full_name } } = req.user as User

  const { data: membersData, success } = await getTeamMembersbyId(team_id,false) as {
    data: any[] | undefined;
    success: boolean
  };

  let currentUser = {
    id,
    email: email || 'unknown@example.com',
    name: full_name || 'Unknown User',
    role: role as 'admin' | 'member',
    status: 'active' as const,
    joinedAt: new Date().toISOString(),
    lastActive: new Date().toISOString()
  };

  // Fall back to current user as admin
  if (!success) {
    res.status(200).json(new ApiResponse(200, [currentUser]));
  }

  let members: AccountTeamMember[] = membersData?.map(member => {
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
  const currentUserExists = members.some(m => m.id === id);
  if (!currentUserExists) {
    members.unshift(currentUser);
  }

  res.status(200).json(new ApiResponse(200, members, 'Team members fetched successfully'));
});