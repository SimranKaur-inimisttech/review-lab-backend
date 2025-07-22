import { asyncHandler } from "@/utils/asyncHandler";
import ApiResponse from "@/utils/ApiResponse";
import { ApiError } from "@/utils/ApiError";
import { supabaseAdmin } from "@/config/supabaseAdmin";
import { validateRequiredFields } from "@/utils/helpers";
import { Request, Response } from "express";
import { addTeamMember, getTeamMembersbyId } from "@/lib/teamMembers";
import { TeamMember } from "@/lib/types/teamMember";

export const getTeamswithMembers = asyncHandler(async (req: Request, res: Response) => {

  const { data: teams, error: teamError } = await req.supabase.from('teams')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (teamError) {
    throw new ApiError(500, teamError.message);
  }

  const teamsWithMembers = await Promise.all(
    (teams || []).map(async (team) => {

      const { data: membersData } = await getTeamMembersbyId(team.id) as {
        data: TeamMember[] | undefined;
      };

      return {
        ...team,
        member_count: membersData?.length || 0,
        members: (membersData || []).map((member) => ({
          id: member.id,
          team_id: member.team_id,
          user_id: member.user_id,
          role: member.role,
          permissions: member.permissions,
          invited_by: member.invited_by,
          invited_at: member.invited_at,
          joined_at: member.joined_at,
          is_active: member.is_active,
          user: member.users,
        })),
      };
    })
  );

  res.status(200).json(new ApiResponse(200, teamsWithMembers, 'Teams fetched successfully'));
});

export const createTeam = asyncHandler(async (req: Request, res: Response) => {
  validateRequiredFields(req.body, ['name']);

  const { error } = await req.supabase
    .from('teams')
    .insert(req.body)

  if (error) {
    throw new ApiError(500, error.message);
  }

  const { data: team, error: teamError } = await supabaseAdmin
    .from('teams')
    .select()
    .eq('name', req.body.name)
    .single();

  // Add owner as team member
  const { success, } = await addTeamMember({
    supabase: req.supabase,
    team_id: team.id,
    user_id: req.body.owner_id,
    role: 'owner',
  }, false);

  if (teamError || !success) {
    // Rollback: delete the team
    await supabaseAdmin.from('teams').delete().eq('id', team.id);
    throw new ApiError(500, 'Error adding owner to team');
  }

  res.status(201).json(new ApiResponse(201, team, 'Teams created successfully'));
});

export const updateTeam = asyncHandler(async (req: Request, res: Response) => {
  validateRequiredFields(req.body, ['name']);

  const { data, error } = await req.supabase
    .from('teams')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    throw new ApiError(500, error.message);
  }

  res.status(200).json(new ApiResponse(200, data, 'Teams updated successfully'));
});

export const deleteTeam = asyncHandler(async (req: Request, res: Response) => {

  const { error } = await req.supabase
    .from('teams')
    .update({
      is_active: false,
    })
    .eq('id', req.params.id);

  if (error) {
    throw new ApiError(500, error.message);
  }

  res.status(200).json(new ApiResponse(200, undefined, 'Teams deleted successfully'));
});