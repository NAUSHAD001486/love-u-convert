# Love U Convert Backend

Production-grade Node.js + TypeScript Express API for image conversion.

## Features

- Redis-based daily quota and rate limiting
- Streaming file uploads with MIME type detection
- Cloudinary integration for image processing
- ZIP streaming for multiple file downloads
- AWS Elastic Beanstalk ready

## Local Development & Testing

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Redis (for quota and rate limiting)
- Cloudinary account (for image processing)

### Setup

1. **Create `.env` file from example:**

   ```bash
   cp .env.example .env
   ```

   ⚠️ **WARNING:** Never commit `.env` file to git. It contains sensitive credentials.

2. **Configure environment variables:**

   Edit `.env` and fill in the required values:

   ```env
   NODE_ENV=development
   PORT=8080
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   REDIS_URL=redis://localhost:6379
   DAILY_BYTES_LIMIT=1073741824
   MAX_FILE_SIZE_BYTES=10485760
   CLEANUP_TTL_SECONDS=86400
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
   ```

   **Environment Variables Explanation:**

   - `NODE_ENV`: Environment mode (`development`, `production`, `test`)
   - `PORT`: Server port (default: 8080)
   - `CLOUDINARY_CLOUD_NAME`: Your Cloudinary cloud name
   - `CLOUDINARY_API_KEY`: Your Cloudinary API key
   - `CLOUDINARY_API_SECRET`: Your Cloudinary API secret
   - `REDIS_URL`: Redis connection URL (e.g., `redis://localhost:6379`)
   - `DAILY_BYTES_LIMIT`: Daily quota limit in bytes (e.g., 1GB = 1073741824)
   - `MAX_FILE_SIZE_BYTES`: Maximum file size in bytes (e.g., 10MB = 10485760)
   - `CLEANUP_TTL_SECONDS`: Time-to-live for uploaded files in seconds (e.g., 86400 = 24 hours)
   - `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
   - `DYNAMODB_TABLE_CONVERSIONS`: DynamoDB table name (optional, for future use)

3. **Install dependencies:**

   ```bash
   npm install
   ```

4. **Start Redis (if running locally):**

   ```bash
   redis-server
   ```

   Or use a cloud Redis service and update `REDIS_URL` accordingly.

### Running the Server

**Development mode (with hot reload):**

```bash
npm run dev
```

**Production build:**

```bash
npm run build
npm start
```

The server will start on `http://localhost:8080` (or the port specified in `.env`).

### Testing with curl

#### Health Check

```bash
curl http://localhost:8080/health
```

Expected response:
```json
{"status":"ok"}
```

#### Single File Conversion

```bash
curl -X POST http://localhost:8080/api/convert/image \
  -F "targetFormat=png" \
  -F "files=@/path/to/your/image.jpg"
```

Expected response:
```json
{
  "success": true,
  "downloadUrl": "https://res.cloudinary.com/...",
  "publicId": "convert_...",
  "createdAt": 1234567890,
  "ttlSeconds": 86400,
  "fileCount": 1
}
```

#### Multiple Files Conversion (ZIP)

```bash
curl -X POST http://localhost:8080/api/convert/image \
  -F "targetFormat=webp" \
  -F "files=@/path/to/image1.jpg" \
  -F "files=@/path/to/image2.png" \
  -F "files=@/path/to/image3.gif"
```

Expected response:
```json
{
  "success": true,
  "downloadUrl": "https://res.cloudinary.com/...",
  "publicId": "convert_zip_...",
  "createdAt": 1234567890,
  "ttlSeconds": 86400,
  "fileCount": 3
}
```

#### Image from URL (Placeholder)

```bash
curl -X POST http://localhost:8080/api/convert/image-from-url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/image.jpg", "targetFormat": "png"}'
```

### Using the Test Script

For convenience, use the provided test script:

```bash
chmod +x scripts/local-test.sh
./scripts/local-test.sh
```

This script will:
- Check if `.env` exists
- Warn about missing critical variables
- Start the server in development mode
- Print example curl commands for testing

### Troubleshooting

**Redis connection errors:**
- Ensure Redis is running: `redis-cli ping`
- Check `REDIS_URL` in `.env`

**Cloudinary upload errors:**
- Verify Cloudinary credentials in `.env`
- Check Cloudinary dashboard for API limits

**File upload errors:**
- Ensure file size is within `MAX_FILE_SIZE_BYTES` limit
- Check daily quota hasn't been exceeded (`DAILY_BYTES_LIMIT`)

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration (Redis, Cloudinary, etc.)
│   ├── controllers/      # Request handlers
│   ├── middlewares/      # Express middlewares
│   ├── routes/           # API routes
│   ├── services/         # Business logic services
│   ├── utils/            # Utility functions
│   └── scripts/          # Redis Lua scripts
├── dist/                 # Compiled JavaScript
├── .env.example          # Environment variables template
└── package.json          # Dependencies and scripts
```

## API Endpoints

- `GET /health` - Health check
- `POST /api/convert/image` - Convert uploaded image(s)
- `POST /api/convert/image-from-url` - Convert image from URL (placeholder)
- `GET /admin/usage` - Usage statistics (placeholder)

## License

ISC

