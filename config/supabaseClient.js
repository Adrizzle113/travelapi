import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// #region agent log
console.log('[DEBUG] Supabase config check:', { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey });
// #endregion

// Only create Supabase client if both URL and key are provided
let supabase = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    // #region agent log
    console.log('[DEBUG] Supabase client created successfully');
    // #endregion
  } catch (error) {
    // #region agent log
    console.error('[DEBUG] Failed to create Supabase client:', error.message);
    // #endregion
    console.warn("⚠️ Supabase client creation failed. Some features may not work.");
  }
} else {
  // #region agent log
  console.warn('[DEBUG] Supabase not configured - SUPABASE_URL and SUPABASE_KEY required');
  // #endregion
  console.warn("⚠️ Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY environment variables.");
}

export { supabase };
