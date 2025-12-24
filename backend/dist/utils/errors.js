"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuotaExceededError = void 0;
class QuotaExceededError extends Error {
    constructor(message = 'Daily upload limit exceeded') {
        super(message);
        this.name = 'QuotaExceededError';
        Object.setPrototypeOf(this, QuotaExceededError.prototype);
    }
}
exports.QuotaExceededError = QuotaExceededError;
