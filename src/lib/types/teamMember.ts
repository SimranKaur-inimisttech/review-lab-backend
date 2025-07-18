import { SupabaseClient } from '@supabase/supabase-js';

export interface TeamMember {
  supabase: SupabaseClient,
  team_id: string,
  user_id: string,
  role?: string,
  invited_by?: string,
  invited_at?:string
}
