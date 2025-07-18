import { ApiError } from '@/utils/ApiError';
import { TeamMember } from './types/teamMember';

export const checkIfUserIsTeamMember = async ({
  supabase,
  team_id,
  user_id,
}: TeamMember) => {
  const { data, error } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', team_id)
    .eq('user_id', user_id)
    .maybeSingle();

  if (error) {
    throw new ApiError(401, error.message || 'Supabase error while checking team membership');
  }

  if (data) {
    throw new ApiError(400, 'User is already a member of the team');
  }
};

export const addTeamMember = async (
  {
    supabase,
    team_id,
    user_id,
    role,
    invited_by,
    invited_at
  }: TeamMember,
  throwOnError: boolean = true
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase
    .from('team_members')
    .insert({
      team_id,
      user_id,
      role,
      invited_by,
      invited_at
    });

  if (error) {
    if (throwOnError) {
      throw new ApiError(500, error.message);
    }
    return { success: false, error: error.message };
  }

  return { success: true };
};
