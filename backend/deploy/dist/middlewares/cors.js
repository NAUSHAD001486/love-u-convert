"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsMiddleware = corsMiddleware;
const env_1 = require("../config/env");
/**
 * CORS middleware - sets headers and handles OPTIONS preflight
 * MUST be mounted before body parsers and upload handlers
 */
function corsMiddleware(req, res, next) {
    // Parse allowed origins from environment variable (comma-separated)
    const allowedOrigins = env_1.env.ALLOWED_ORIGINS
        ? env_1.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
        : [];
    const origin = req.headers.origin;
    // Determine allowed origin
    let allowedOrigin;
    if (origin && allowedOrigins.includes(origin)) {
        // If request origin matches allowed list → return same origin
        allowedOrigin = origin;
    }
    else if (allowedOrigins.length > 0) {
        // If origin is missing or not matched → fallback to first allowed origin
        allowedOrigin = allowedOrigins[0];
    }
    else {
        // Final fallback: '*' only if ALLOWED_ORIGINS is empty
        allowedOrigin = '*';
    }
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
    res.setHeader('Access-Control-Max-Age', '86400');
    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
    }
    next();
}
