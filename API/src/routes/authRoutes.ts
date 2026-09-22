import express from 'express';
import { AuthService } from '../services/authService';

const router = express.Router();
const authService = new AuthService();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  const result = await authService.login(username, password);

  if (result.success) {
    res.json(result);
  } else {
    res.status(401).json(result);
  }
});

router.post('/verify', async (req, res) => {
  const { token } = req.body;
  const isValid = await authService.verifyToken(token);
  res.json({ valid: isValid });
});

export default router;








