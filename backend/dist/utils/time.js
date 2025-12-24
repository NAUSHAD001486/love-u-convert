"use strict";
// UTC helpers
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentEpochSeconds = exports.getSecondsUntilMidnightUTC = exports.formatUTC = exports.getUTCTimestamp = exports.getCurrentUTC = void 0;
const getCurrentUTC = () => {
    return new Date();
};
exports.getCurrentUTC = getCurrentUTC;
const getUTCTimestamp = () => {
    return Date.now();
};
exports.getUTCTimestamp = getUTCTimestamp;
const formatUTC = (date) => {
    return date.toISOString();
};
exports.formatUTC = formatUTC;
const getSecondsUntilMidnightUTC = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0);
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
};
exports.getSecondsUntilMidnightUTC = getSecondsUntilMidnightUTC;
const getCurrentEpochSeconds = () => {
    return Math.floor(Date.now() / 1000);
};
exports.getCurrentEpochSeconds = getCurrentEpochSeconds;
