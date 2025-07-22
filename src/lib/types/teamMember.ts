import { SupabaseClient } from '@supabase/supabase-js';

export interface TeamMember {
  supabase?: SupabaseClient,
  id?: string,
  team_id?: string,
  user_id?: string,
  role?: string,
  invited_by?: string,
  invited_at?: string,
  permissions?: Record<string, unknown>,
  joined_at?: string;
  is_active?: boolean;
  users?: {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export interface AccountTeamMember {
  id: string;
  email: string;
  name: string;
  team_id?: string;
  user_id?: string;
  role: 'admin' | 'member';  
  status: 'active' | 'pending' | 'suspended';
  joinedAt: string;
  lastActive: string;
  avatar?: string;
}
