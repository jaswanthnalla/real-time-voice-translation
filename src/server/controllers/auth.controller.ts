import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tokens = await userService.register(req.body);
    res.status(201).json({ success: true, data: tokens });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tokens = await userService.login(req.body);
    res.json({ success: true, data: tokens });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;
    const tokens = await userService.refreshToken(refreshToken);
    res.json({ success: true, data: tokens });
  } catch (error) {
    next(error);
  }
}
