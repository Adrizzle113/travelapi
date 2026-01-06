import { supabase } from './supabaseClient.js';

const initializeDatabase = async () => {
  try {
    // Check if Supabase is configured
    if (!supabase) {
      console.log('⚠️ Supabase not configured - database features will be disabled');
      console.log('   Set SUPABASE_URL and SUPABASE_KEY environment variables to enable');
      return false;
    }

    console.log('🗄️ Initializing Supabase database connection...');

    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    console.log('✅ Connected to Supabase database');
    console.log('✅ Users table ready');
    console.log('✅ Auth logs table ready');

    return true;
  } catch (err) {
    console.error('❌ Error connecting to database:', err.message);
    console.error('⚠️ Database features will be disabled');
    // Don't throw - allow server to start without database
    return false;
  }
};

const getDatabase = () => {
  return supabase;
};

const logAuthAttempt = async (userId, email, result, duration) => {
  try {
    if (!supabase) {
      console.log('⚠️ Supabase not configured - skipping auth log');
      return null;
    }

    const logEntry = {
      user_id: userId,
      email,
      success: result.success || false,
      error_message: result.error || null,
      duration: duration || null,
      session_id: result.sessionId || null,
      final_url: result.loginUrl || result.finalUrl || null,
      timestamp: new Date().toISOString()
    };

    console.log('📋 AUTH LOG:', JSON.stringify(logEntry, null, 2));

    const { data, error } = await supabase
      .from('auth_logs')
      .insert([logEntry])
      .select()
      .single();

    if (error) {
      console.error('❌ Error logging auth attempt:', error.message);
      throw error;
    }

    return data;
  } catch (err) {
    console.error('❌ Error in logAuthAttempt:', err.message);
    // Don't throw - allow operation to continue without logging
    return null;
  }
};

const getAuthStats = async () => {
  try {
    if (!supabase) {
      console.log('⚠️ Supabase not configured - returning empty stats');
      return {
        total_attempts: 0,
        successful_attempts: 0,
        avg_duration: 0,
        unique_users: 0,
        attempts_24h: 0
      };
    }

    const { data, error } = await supabase.rpc('get_auth_stats');

    if (error) {
      console.error('Stats query error:', error);
      const { data: logs, error: logsError } = await supabase
        .from('auth_logs')
        .select('*');

      if (logsError) throw logsError;

      const stats = {
        total_attempts: logs.length,
        successful_attempts: logs.filter(log => log.success).length,
        avg_duration: logs.reduce((sum, log) => sum + (log.duration || 0), 0) / logs.length || 0,
        unique_users: new Set(logs.map(log => log.email)).size,
        attempts_24h: logs.filter(log => {
          const logTime = new Date(log.timestamp);
          const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return logTime > dayAgo;
        }).length
      };

      return stats;
    }

    return data;
  } catch (err) {
    console.error('Error getting auth stats:', err.message);
    throw err;
  }
};

export {
  initializeDatabase,
  getDatabase,
  logAuthAttempt,
  getAuthStats
};