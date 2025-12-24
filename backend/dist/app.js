"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const requestId_1 = require("./middlewares/requestId");
const cors_1 = require("./middlewares/cors");
const errorHandler_1 = require("./middlewares/errorHandler");
const notFound_1 = require("./middlewares/notFound");
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const convert_routes_1 = __importDefault(require("./routes/convert.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const docs_routes_1 = __importDefault(require("./routes/docs.routes"));
const app = (0, express_1.default)();
exports.app = app;
app.use(cors_1.corsMiddleware);
app.use(requestId_1.requestIdMiddleware);
// health check (no body parsing)
app.get('/', (req, res) => {
    res.json({ status: 'ok' });
});
// multipart routes MUST come BEFORE express.json
app.use(convert_routes_1.default);
// now safe to parse JSON bodies
app.use(express_1.default.json());
// API documentation (Swagger UI)
app.use('/docs', docs_routes_1.default);
// remaining routes
app.use(health_routes_1.default);
app.use(admin_routes_1.default);
app.use(notFound_1.notFound);
app.use(errorHandler_1.errorHandler);
