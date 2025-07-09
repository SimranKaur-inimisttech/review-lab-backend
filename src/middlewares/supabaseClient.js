// middleware/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

export const attachSupabase = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  req.supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: token ? `Bearer ${token}` : undefined,
      },
    },
  });

  next();
};
