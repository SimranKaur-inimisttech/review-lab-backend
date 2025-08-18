import { createClient } from '@supabase/supabase-js';

// Environment variables 
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Validate required environment variables
if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing required Supabase environment variables');
}

// Create and export the Supabase client instance with auth configuration
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);