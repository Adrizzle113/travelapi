import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabaseClient.js';

const router = express.Router();

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  return password && password.length >= 6;
};

router.post('/register', async (req, res) => {
  try {
    const { email, password, ratehawkEmail } = req.body;

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

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{
        email,
        password: hashedPassword,
        ratehawk_email: ratehawkEmail || email,
        status: 'active'
      }])
      .select()
      .single();

    if (insertError) {
      console.error('Registration error:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Database error during registration'
      });
    }

    const token = jwt.sign(
      { userId: newUser.id, email },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: '24h' }
    );

    console.log(`✅ User registered: ${email} (ID: ${newUser.id})`);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        ratehawkEmail: newUser.ratehawk_email || email
      }
    });
  } catch (error) {
    console.error('💥 Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during registration'
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

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

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('status', 'active')
      .maybeSingle();

    if (userError) {
      console.error('Login database error:', userError);
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

    if (!user.password) {
      console.log(`❌ Login attempt failed: No password set for ${email}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log(`❌ Login attempt failed: Invalid password for ${email}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

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
  } catch (error) {
    console.error('💥 Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during login'
    });
  }
});

router.get('/verify', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, ratehawk_email, last_login')
      .eq('id', decoded.userId)
      .eq('status', 'active')
      .maybeSingle();

    if (error || !user) {
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
  } catch (tokenError) {
    console.error('Token verification error:', tokenError);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
});

router.get('/profile', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, ratehawk_email, last_login, created_at')
      .eq('id', decoded.userId)
      .eq('status', 'active')
      .maybeSingle();

    if (userError || !user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    const { data: allLogs } = await supabase
      .from('auth_logs')
      .select('success')
      .eq('user_id', decoded.userId);

    const loginAttempts = allLogs?.length || 0;
    const successfulLogins = allLogs?.filter(log => log.success).length || 0;

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        ratehawkEmail: user.ratehawk_email || user.email,
        lastLogin: user.last_login,
        createdAt: user.created_at,
        loginAttempts,
        successfulLogins
      }
    });
  } catch (tokenError) {
    console.error('Profile fetch error:', tokenError);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
});

export default router;