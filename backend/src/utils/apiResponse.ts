import { Response } from 'express';

/**
 * Send a successful API response
 * @param res - Express response object
 * @param payload - Payload to include in response
 */
export const ok = (res: Response, payload: Record<string, any>): Response => {
  return res.json({
    success: true,
    ...payload,
  });
};

/**
 * Send a failed API response
 * @param res - Express response object
 * @param statusCode - HTTP status code
 * @param code - Error code
 * @param message - Error message
 * @param details - Optional error details
 */
export const fail = (
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, any>
): Response => {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  });
};

