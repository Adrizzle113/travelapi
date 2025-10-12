import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../config/database.js';

const router = express.Router();

// Validation helpers
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  return password && password.length >= 6;
};

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { email, password, ratehawkEmail } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address'
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const db = getDatabase();

    db.run(
      `INSERT INTO users (email, password, ratehawk_email) VALUES (?, ?, ?)`,
      [email, hashedPassword, ratehawkEmail || email],
      function (err) {
        if (err) {
          console.error('Registration error:', err);
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({
              success: false,
              error: 'An account with this email already exists'
            });
          }
          return res.status(500).json({
            success: false,
            error: 'Database error during registration'
          });
        }

        const token = jwt.sign(
          { userId: this.lastID, email },
          process.env.JWT_SECRET || 'fallback-secret-key',
          { expiresIn: '24h' }
        );

        console.log(`✅ User registered: ${email} (ID: ${this.lastID})`);

        res.status(201).json({
          success: true,
          message: 'Account created successfully',
          token,
          user: {
            id: this.lastID,
            email,
            ratehawkEmail: ratehawkEmail || email
          }
        });
      }
    );
  } catch (error) {
    console.error('💥 Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during registration'
    });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address'
      });
    }

    const db = getDatabase();

    db.get(
      'SELECT * FROM users WHERE email = ? AND status = ?',
      [email, 'active'],
      async (err, user) => {
        if (err) {
          console.error('Login database error:', err);
          return res.status(500).json({
            success: false,
            error: 'Database error during login'
          });
        }

        if (!user) {
          console.log(`❌ Login attempt failed: User not found for ${email}`);
          return res.status(401).json({
            success: false,
            error: 'Invalid email or password'
          });
        }

        try {
          const isValidPassword = await bcrypt.compare(password, user.password);
          if (!isValidPassword) {
            console.log(`❌ Login attempt failed: Invalid password for ${email}`);
            return res.status(401).json({
              success: false,
              error: 'Invalid email or password'
            });
          }

          // Update last login
          db.run(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [user.id],
            (updateErr) => {
              if (updateErr) {
                console.error('Error updating last login:', updateErr);
              }
            }
          );

          const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET || 'fallback-secret-key',
            { expiresIn: '24h' }
          );

          console.log(`✅ User logged in: ${email} (ID: ${user.id})`);

          res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
              id: user.id,
              email: user.email,
              ratehawkEmail: user.ratehawk_email || user.email,
              lastLogin: user.last_login
            }
          });
        } catch (bcryptError) {
          console.error('Password comparison error:', bcryptError);
          return res.status(500).json({
            success: false,
            error: 'Authentication error'
          });
        }
      }
    );
  } catch (error) {
    console.error('💥 Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during login'
    });
  }
});

// Verify token endpoint
router.get('/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');

    const db = getDatabase();
    db.get(
      'SELECT id, email, ratehawk_email, last_login FROM users WHERE id = ? AND status = ?',
      [decoded.userId, 'active'],
      (err, user) => {
        if (err || !user) {
          return res.status(401).json({
            success: false,
            error: 'Invalid token'
          });
        }

        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            ratehawkEmail: user.ratehawk_email || user.email,
            lastLogin: user.last_login
          }
        });
      }
    );
  } catch (tokenError) {
    console.error('Token verification error:', tokenError);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
});

// Get user profile
router.get('/profile', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');

    const db = getDatabase();
    db.get(
      `SELECT 
        id, email, ratehawk_email, last_login, created_at,
        (SELECT COUNT(*) FROM auth_logs WHERE user_id = ?) as login_attempts,
        (SELECT COUNT(*) FROM auth_logs WHERE user_id = ? AND success = 1) as successful_logins
       FROM users WHERE id = ? AND status = ?`,
      [decoded.userId, decoded.userId, decoded.userId, 'active'],
      (err, user) => {
        if (err || !user) {
          return res.status(401).json({
            success: false,
            error: 'User not found'
          });
        }

        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            ratehawkEmail: user.ratehawk_email || user.email,
            lastLogin: user.last_login,
            createdAt: user.created_at,
            loginAttempts: user.login_attempts || 0,
            successfulLogins: user.successful_logins || 0
          }
        });
      }
    );
  } catch (tokenError) {
    console.error('Profile fetch error:', tokenError);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
});

export default router;