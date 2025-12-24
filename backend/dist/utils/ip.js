"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractClientIP = void 0;
const extractClientIP = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
};
exports.extractClientIP = extractClientIP;
