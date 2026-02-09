import { Request, Response, NextFunction } from 'express';

/**
 * Error handling middleware for Express
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const message = err.message || 'Internal Server Error';
  console.error(`[Error] ${message}`, err.stack);
  res.status(500).json({ error: message });
}

export default errorHandler;
