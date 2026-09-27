import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { signToken, authenticateToken, AuthRequest, createRateLimiter } from './jwt';

export const authRouter = Router();

// Rate limiters for authentication endpoints
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 30,
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
});

// USER SIGNUP
authRouter.post('/signup', authLimiter, async (req: Request, res: Response) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Name, email, and password are required.',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        error: 'PASSWORD_MISMATCH',
        message: 'Password confirmation does not match.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'Password must be at least 8 characters long.',
      });
    }

    const existingUser = await db.users.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'USER_ALREADY_EXISTS',
        message: 'An account with this email address already exists.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await db.users.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role: 'USER',
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    }, true);

    res.cookie('funclubsi_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    await db.auditLogs.record({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: 'USER_SIGNUP',
      resource: 'auth/signup',
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err: any) {
    console.error('Signup error:', err);
    return res.status(500).json({
      error: 'DATABASE_ERROR',
      message: 'Failed to create user account. Please try again.',
    });
  }
});

// USER LOGIN
authRouter.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, rememberMe = true } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Email and password are required.',
      });
    }

    const user = await db.users.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    }, rememberMe);

    res.cookie('funclubsi_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000,
    });

    await db.auditLogs.record({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: 'USER_LOGIN',
      resource: 'auth/login',
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({
      error: 'DATABASE_ERROR',
      message: 'Authentication service encountered an unexpected error.',
    });
  }
});

// SEPARATE ADMIN LOGIN
authRouter.post('/admin/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid admin credentials',
      });
    }

    const user = await db.users.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid admin credentials',
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid admin credentials',
      });
    }

    // Role verification: strictly require ADMIN role
    if (user.role !== 'ADMIN') {
      await db.auditLogs.record({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: 'ADMIN_ACCESS_DENIED',
        resource: 'auth/admin/login',
        details: { reason: 'Non-admin user attempted admin login' },
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Account is not an administrator',
      });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    }, true);

    res.cookie('funclubsi_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    await db.auditLogs.record({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: 'ADMIN_LOGIN_SUCCESS',
      resource: 'auth/admin/login',
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err: any) {
    console.error('Admin login error:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Server/database error',
    });
  }
});

// GET CURRENT SESSION / ME
authRouter.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await db.users.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User session exists but account was not found.',
      });
    }

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    return res.status(500).json({
      error: 'DATABASE_ERROR',
      message: 'Failed to retrieve current user session.',
    });
  }
});

// LOGOUT
authRouter.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('funclubsi_token');
  return res.json({ message: 'Successfully logged out' });
});

// UPDATE PROFILE
authRouter.put('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { name, avatar, currentPassword, newPassword } = req.body;
    const user = await db.users.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }

    const updates: any = {};
    if (name) updates.name = name.trim();
    if (avatar) updates.avatar = avatar;

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          error: 'CURRENT_PASSWORD_REQUIRED',
          message: 'Current password is required to set a new password.',
        });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        return res.status(400).json({
          error: 'INVALID_CURRENT_PASSWORD',
          message: 'The current password provided is incorrect.',
        });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({
          error: 'WEAK_PASSWORD',
          message: 'New password must be at least 8 characters.',
        });
      }
      const salt = await bcrypt.genSalt(10);
      updates.passwordHash = await bcrypt.hash(newPassword, salt);
    }

    const updated = await db.users.update(user.id, updates);
    return res.json({
      user: {
        id: updated!.id,
        name: updated!.name,
        email: updated!.email,
        role: updated!.role,
        avatar: updated!.avatar,
      },
    });
  } catch (err) {
    return res.status(500).json({
      error: 'DATABASE_ERROR',
      message: 'Failed to update profile.',
    });
  }
});

// FORGOT PASSWORD REQUEST
authRouter.post('/forgot-password', authLimiter, async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'INVALID_EMAIL', message: 'Email address is required.' });
  }

  // To prevent user enumeration, always respond with success
  return res.json({
    message: 'If an account exists for this email, password reset instructions have been sent.',
  });
});
