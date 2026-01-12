"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = void 0;
/**
 * 404 Not Found handler
 * CORS headers are already set by corsMiddleware (runs first)
 * This handler ONLY sends JSON response body
 */
const notFound = (req, res) => {
    // Send 404 response (CORS headers already set by corsMiddleware)
    // Only send JSON body, do NOT set headers
    if (!res.headersSent) {
        res.status(404).json({ error: 'Not found' });
    }
};
exports.notFound = notFound;
