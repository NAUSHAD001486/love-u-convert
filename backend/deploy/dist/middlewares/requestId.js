"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = void 0;
const crypto_1 = require("crypto");
const requestIdMiddleware = (req, res, next) => {
    const requestId = req.headers['x-request-id'] || (0, crypto_1.randomUUID)();
    req.headers['x-request-id'] = requestId;
    // Only set header if headers haven't been sent yet
    // This prevents ERR_HTTP_HEADERS_SENT when corsMiddleware flushes headers first
    if (!res.headersSent) {
        res.setHeader('X-Request-Id', requestId);
    }
    next();
};
exports.requestIdMiddleware = requestIdMiddleware;
