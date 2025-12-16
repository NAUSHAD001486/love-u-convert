import { Request, Response, NextFunction } from 'express';

// Stub middleware (no logic yet)
export const ssrfGuard = (req: Request, res: Response, next: NextFunction) => {
  // TODO: Implement SSRF protection logic
  next();
};

