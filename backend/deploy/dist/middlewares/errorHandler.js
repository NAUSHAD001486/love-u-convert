"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
function errorHandler(err, req, res, next) {
    // If response already sent, DO NOTHING
    if (res.headersSent) {
        return;
    }
    const statusCode = err?.statusCode || 500;
    const code = err?.code || 'INTERNAL_ERROR';
    const message = err?.message || 'Internal server error';
    res.status(statusCode).json({
        success: false,
        error: {
            code,
            message,
        },
    });
    // IMPORTANT: no next(), no throw
}
