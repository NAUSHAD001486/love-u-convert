"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const openapi_1 = require("../docs/openapi");
const router = (0, express_1.Router)();
// Serve OpenAPI spec as JSON
router.get('/openapi.json', (req, res) => {
    res.json(openapi_1.openApiSpec);
});
// Serve Swagger UI
router.use('/', swagger_ui_express_1.default.serve);
router.get('/', swagger_ui_express_1.default.setup(openapi_1.openApiSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Love U Convert API Documentation',
}));
exports.default = router;
