import { ApiError } from '@/utils/ApiError';
import { SupabaseClient } from '@supabase/supabase-js';

export const checkIfUserIsTeamMember = async ({
  supabase,
  teamId,
  userId,
}: {
  supabase: SupabaseClient;
  teamId: string;
  userId: string;
}) => {
  const { data, error } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .maybeSingle();

  if (data) {
    throw new ApiError(400, 'User is already a member of the team');
  }
};
