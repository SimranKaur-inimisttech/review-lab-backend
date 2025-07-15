import { asyncHandler } from "@/utils/asyncHandler";
import ApiResponse from "@/utils/ApiResponse";
import { ApiError } from "@/utils/ApiError";
import { supabaseAdmin } from "@/config/supabaseAdmin";
import { validateRequiredFields } from "@/utils/helpers";

export const getTeamswithMembers = asyncHandler(async (req, res) => {

  const { data: teams, error: teamError } = await req.supabase.from('teams')
    .select('*')
    .order('created_at', { ascending: false });

  if (teamError) {
    throw new ApiError(500, teamError.message);
  }

  const teamsWithMembers = await Promise.all(
    (teams || []).map(async (team) => {
      const { data: membersData, error: membersError } = await req.supabase
        .from('team_members')
        .select(`
        *,
        users!team_members_user_id_fkey (
          id,
          email,
          full_name,
          avatar_url
        )
      `)
        .eq('team_id', team.id)
        .eq('is_active', true);

      if (membersError) {
        throw new ApiError(500, membersError.message);
      }
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

export const createTeam = asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['name']);

  const { error } = await req.supabase
    .from('teams')
    .insert(req.body)

  if (error) {
    throw new ApiError(error.status, error.message);
  }

  const { data: team, error: teamError } = await supabaseAdmin
    .from('teams')
    .select()
    .eq('name', req.body.name)
    .single();

  // Add owner as team member
  validateRequiredFields(req.body, ['team_id','user_id']);
  const { error: memberError } = await req.supabase
    .from('team_members')
    .insert({
      team_id: team.id,
      user_id: req.body.owner_id,
      role: 'owner',
    });

  if (memberError) {
    // Rollback: delete the team
    const res = await supabaseAdmin.from('teams').delete().eq('id', team.id);
    throw new ApiError(memberError.status, 'Error adding owner to team');
  }

  res.status(201).json(new ApiResponse(201, team, 'Teams created successfully'));
});