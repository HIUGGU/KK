import prisma from '../config/database';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface LoginResult {
  success: boolean;
  token?: string;
  message?: string;
}

export class AuthService {
  async login(username: string, password: string): Promise<LoginResult> {
    try {
      const admin = await prisma.admin.findUnique({
        where: { username },
      });

      if (!admin) {
        return { success: false, message: 'Invalid username or password' };
      }

      // For now, compare plain text (in production, use bcrypt)
      // If password is hashed, use: const isValid = await bcrypt.compare(password, admin.password);
      const isValid = password === admin.password;

      if (!isValid) {
        return { success: false, message: 'Invalid username or password' };
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: admin.id, username: admin.username },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return { success: true, token };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Login failed. Please try again.' };
    }
  }

  async verifyToken(token: string): Promise<boolean> {
    try {
      jwt.verify(token, JWT_SECRET);
      return true;
    } catch (error) {
      return false;
    }
  }
}
