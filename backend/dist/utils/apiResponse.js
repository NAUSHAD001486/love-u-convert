"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fail = exports.ok = void 0;
/**
 * Send a successful API response
 * @param res - Express response object
 * @param payload - Payload to include in response
 */
const ok = (res, payload) => {
    return res.json({
        success: true,
        ...payload,
    });
};
exports.ok = ok;
/**
 * Send a failed API response
 * @param res - Express response object
 * @param statusCode - HTTP status code
 * @param code - Error code
 * @param message - Error message
 * @param details - Optional error details
 */
const fail = (res, statusCode, code, message, details) => {
    return res.status(statusCode).json({
        success: false,
        error: {
            code,
            message,
            ...(details && { details }),
        },
    });
};
exports.fail = fail;
