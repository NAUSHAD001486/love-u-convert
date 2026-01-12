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
// 1. CORS middleware MUST be first to ensure headers are set before any processing
app.use(cors_1.corsMiddleware);
// 2. Request ID middleware
app.use(requestId_1.requestIdMiddleware);
// 3. Body parsers MUST come before routes
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// 4. Routes
// health check
app.get('/', (req, res) => {
    res.json({ status: 'ok' });
});
// convert routes (multipart/form-data handled by uploadStream middleware)
app.use(convert_routes_1.default);
// API documentation (Swagger UI)
app.use('/docs', docs_routes_1.default);
// remaining routes
app.use(health_routes_1.default);
app.use(admin_routes_1.default);
// 5. Not found handler
app.use(notFound_1.notFound);
// 6. Error handler (must be last)
app.use(errorHandler_1.errorHandler);
