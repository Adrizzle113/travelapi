const sqlite3 = require('sqlite3').verbose();

let db;

const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    console.log('🗄️ Initializing SQLite database...');
    
    db = new sqlite3.Database('users.db', (err) => {
      if (err) {
        console.error('❌ Error opening database:', err.message);
        reject(err);
      } else {
        console.log('✅ Connected to SQLite database');
        
        // Create users table if it doesn't exist
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            ratehawk_email TEXT,
            status TEXT DEFAULT 'active'
          )
        `, (err) => {
          if (err) {
            console.error('❌ Error creating users table:', err.message);
            reject(err);
          } else {
            console.log('✅ Users table ready');
            
            // Create auth logs table for debugging
            db.run(`
              CREATE TABLE IF NOT EXISTS auth_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                email TEXT NOT NULL,
                success INTEGER NOT NULL,
                error_message TEXT,
                duration INTEGER,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                session_id TEXT,
                final_url TEXT
              )
            `, (err) => {
              if (err) {
                console.error('❌ Error creating auth_logs table:', err.message);
                reject(err);
              } else {
                console.log('✅ Auth logs table ready');
                resolve();
              }
            });
          }
        });
      }
    });
  });
};

const getDatabase = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
};

// Helper function to log authentication attempts
const logAuthAttempt = (userId, email, result, duration) => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    const timestamp = new Date().toISOString();
    
    const logEntry = {
      timestamp,
      userId,
      email,
      success: result.success ? 1 : 0,
      error: result.error || null,
      duration: duration || null,
      sessionId: result.sessionId || null,
      finalUrl: result.loginUrl || result.finalUrl || null
    };
    
    console.log('📋 AUTH LOG:', JSON.stringify(logEntry, null, 2));
    
    db.run(`
      INSERT INTO auth_logs (user_id, email, success, error_message, duration, session_id, final_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      logEntry.userId,
      logEntry.email,
      logEntry.success,
      logEntry.error,
      logEntry.duration,
      logEntry.sessionId,
      logEntry.finalUrl
    ], function(err) {
      if (err) {
        console.error('❌ Error logging auth attempt:', err.message);
        reject(err);
      } else {
        resolve(logEntry);
      }
    });
  });
};

// Helper function to get auth statistics
const getAuthStats = () => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    db.all(`
      SELECT 
        COUNT(*) as total_attempts,
        SUM(success) as successful_attempts,
        AVG(duration) as avg_duration,
        COUNT(DISTINCT email) as unique_users,
        COUNT(CASE WHEN timestamp > datetime('now', '-24 hours') THEN 1 END) as attempts_24h
      FROM auth_logs
    `, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows[0]);
      }
    });
  });
};

module.exports = { 
  initializeDatabase, 
  getDatabase, 
  logAuthAttempt, 
  getAuthStats 
};