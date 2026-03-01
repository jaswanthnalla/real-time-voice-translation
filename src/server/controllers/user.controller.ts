import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as userService from '../services/user.service';

export async function getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await userService.getProfile(req.user!.userId);
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    // For now, return current profile - update logic to be expanded
    const profile = await userService.getProfile(req.user!.userId);
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
}
