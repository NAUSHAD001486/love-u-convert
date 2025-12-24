/**
 * OpenAPI 3.0.3 specification for Love U Convert API
 */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Love U Convert API',
    version: 'v1',
    description: 'File conversion API with async jobs. Upload images and convert them to various formats using Cloudinary.',
  },
  servers: [
    {
      url: 'http://localhost:8080',
      description: 'Local development server',
    },
    {
      url: 'https://api.example.com',
      description: 'Production server',
    },
  ],
  paths: {
    '/api/convert/image': {
      post: {
        summary: 'Convert image(s) to target format',
        description: 'Upload one or more image files and convert them to the specified target format. Returns a job ID for tracking conversion progress.',
        operationId: 'convertImage',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['files', 'targetFormat'],
                properties: {
                  files: {
                    type: 'array',
                    items: {
                      type: 'string',
                      format: 'binary',
                    },
                    description: 'Image files to convert (supports multiple files)',
                  },
                  'files[]': {
                    type: 'array',
                    items: {
                      type: 'string',
                      format: 'binary',
                    },
                    description: 'Alternative field name for multiple files',
                  },
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Single file upload (alternative field name)',
                  },
                  targetFormat: {
                    type: 'string',
                    enum: ['png', 'bmp', 'eps', 'gif', 'ico', 'jpeg', 'jpg', 'svg', 'psd', 'tga', 'tiff', 'webp'],
                    description: 'Target format for conversion',
                    example: 'webp',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Job created successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/JobQueued',
                },
              },
            },
          },
          '400': {
            description: 'Bad request (missing files, invalid format, etc.)',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          '415': {
            description: 'Unsupported media type',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/job/{jobId}': {
      get: {
        summary: 'Get job status and result',
        description: 'Retrieve the current status and result of a conversion job. Returns different response shapes based on job status.',
        operationId: 'getJob',
        parameters: [
          {
            name: 'jobId',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Job ID returned from POST /api/convert/image',
            example: '1234567890_abc123def456',
          },
        ],
        responses: {
          '200': {
            description: 'Job status retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { $ref: '#/components/schemas/JobProcessing' },
                    { $ref: '#/components/schemas/JobCompleted' },
                    { $ref: '#/components/schemas/JobCompletedWithErrors' },
                  ],
                },
              },
            },
          },
          '404': {
            description: 'Job not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          '500': {
            description: 'Job failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/JobFailed',
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      JobQueued: {
        type: 'object',
        required: ['success', 'job'],
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          job: {
            type: 'object',
            required: ['id', 'status'],
            properties: {
              id: {
                type: 'string',
                description: 'Job ID for tracking',
                example: '1234567890_abc123def456',
              },
              status: {
                type: 'string',
                enum: ['queued'],
                example: 'queued',
              },
            },
          },
        },
      },
      JobProcessing: {
        type: 'object',
        required: ['success', 'job'],
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          job: {
            type: 'object',
            required: ['id', 'status', 'progress'],
            properties: {
              id: {
                type: 'string',
                example: '1234567890_abc123def456',
              },
              status: {
                type: 'string',
                enum: ['queued', 'processing'],
                example: 'processing',
              },
              progress: {
                type: 'object',
                required: ['processed', 'total'],
                properties: {
                  processed: {
                    type: 'number',
                    description: 'Number of files processed',
                    example: 3,
                  },
                  total: {
                    type: 'number',
                    description: 'Total number of files',
                    example: 10,
                  },
                },
              },
            },
          },
        },
      },
      JobCompleted: {
        type: 'object',
        required: ['success', 'job'],
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          job: {
            type: 'object',
            required: ['id', 'status', 'result'],
            properties: {
              id: {
                type: 'string',
                example: '1234567890_abc123def456',
              },
              status: {
                type: 'string',
                enum: ['completed'],
                example: 'completed',
              },
              result: {
                type: 'object',
                required: ['downloadUrl', 'fileCount', 'expiresIn'],
                properties: {
                  downloadUrl: {
                    type: 'string',
                    format: 'uri',
                    description: 'URL to download converted file(s)',
                    example: 'https://res.cloudinary.com/example/image/upload/v123/convert_zip_123.zip',
                  },
                  fileCount: {
                    type: 'number',
                    description: 'Number of files in the result',
                    example: 10,
                  },
                  expiresIn: {
                    type: 'number',
                    description: 'Time until download expires (seconds)',
                    example: 86400,
                  },
                },
              },
            },
          },
        },
      },
      JobCompletedWithErrors: {
        type: 'object',
        required: ['success', 'job'],
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          job: {
            type: 'object',
            required: ['id', 'status', 'result'],
            properties: {
              id: {
                type: 'string',
                example: '1234567890_abc123def456',
              },
              status: {
                type: 'string',
                enum: ['completed_with_errors'],
                example: 'completed_with_errors',
              },
              result: {
                type: 'object',
                required: ['downloadUrl', 'fileCount', 'failedFiles'],
                properties: {
                  downloadUrl: {
                    type: 'string',
                    format: 'uri',
                    description: 'URL to download ZIP containing successfully converted files',
                    example: 'https://res.cloudinary.com/example/image/upload/v123/convert_zip_123.zip',
                  },
                  fileCount: {
                    type: 'number',
                    description: 'Number of successfully converted files',
                    example: 8,
                  },
                  failedFiles: {
                    type: 'array',
                    items: {
                      type: 'string',
                    },
                    description: 'List of filenames that failed to convert',
                    example: ['test-small.png', 'db.jpg'],
                  },
                },
              },
            },
          },
        },
      },
      JobFailed: {
        type: 'object',
        required: ['success', 'error'],
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                example: 'FILE_CONVERSION_FAILED',
              },
              message: {
                type: 'string',
                example: 'test-small.png — File size too large; db.jpg — ECONNRESET',
              },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['success', 'error'],
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                description: 'Error code',
                examples: ['UNSUPPORTED_TARGET_FORMAT', 'NO_FILES_PROVIDED', 'MISSING_TARGET_FORMAT', 'JOB_NOT_FOUND'],
              },
              message: {
                type: 'string',
                description: 'Human-readable error message',
                example: 'Target format "xyz" is not supported. Allowed formats: png, bmp, eps, ...',
              },
              details: {
                type: 'object',
                description: 'Additional error details',
                additionalProperties: true,
              },
            },
          },
        },
      },
    },
  },
};

