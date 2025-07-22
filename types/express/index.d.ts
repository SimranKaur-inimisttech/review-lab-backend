import { SupabaseClient } from '@supabase/supabase-js';
import { User } from '@supabase/supabase-js';
declare global {
  namespace Express {
    interface Request {
      supabase: SupabaseClient;
      user?: User;
    }
  }
}
