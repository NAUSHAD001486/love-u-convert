# Love U Convert - Frontend

Production-ready Next.js frontend for the Love U Convert image converter website.

## Features

- 🎨 Modern, clean UI with Tailwind CSS
- 📱 Fully responsive design
- ♿ Accessible (keyboard navigation, focus states)
- 🚀 Optimized for performance
- 🔄 Real-time job status polling
- 📦 Support for single file and ZIP downloads
- ✅ File validation with helpful error messages

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **React 18**

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file:
```bash
cp .env.local.example .env.local
```

3. Update `.env.local` with your API URL:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

### Development

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

Build for production:
```bash
npm run build
```

Start production server:
```bash
npm start
```

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx       # Root layout with SEO meta tags
│   ├── page.tsx         # Main page component
│   └── globals.css      # Global styles
├── components/
│   ├── Header.tsx              # Fixed header with scroll detection
│   ├── UploadBox.tsx           # Drag-and-drop upload area
│   ├── FileList.tsx            # File list with delete/settings
│   ├── FileSourceDropdown.tsx  # File source selection dropdown
│   ├── OutputSettings.tsx      # Output format selector
│   └── ConvertButton.tsx       # Convert/Download button
├── hooks/
│   └── useScrollDirection.ts   # Scroll direction detection hook
├── utils/
│   ├── fileValidation.ts       # File type validation utilities
│   └── api.ts                  # API integration functions
├── types/
│   └── index.ts                # TypeScript type definitions
└── package.json
```

## API Integration

The frontend communicates with the backend API:

- `POST /api/convert/image` - Upload files for conversion
- `GET /api/job/:id` - Poll job status
- `GET /api/download/zip/:id` - Download ZIP file

## Supported Formats

### Input Formats
- PNG, BMP, EPS, GIF, JPEG, JPG, SVG, TIFF, WEBP

### Output Formats
- PNG, BMP, EPS, GIF, ICO, JPEG, JPG, SVG, PSD, TGA, TIFF, WEBP

### Rejected Input Formats
- ICO, TGA (with helpful error message)

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variable: `NEXT_PUBLIC_API_BASE_URL`
4. Deploy!

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- AWS Amplify
- Railway
- Render

## Environment Variables

- `NEXT_PUBLIC_API_BASE_URL` - Backend API base URL (required)

## License

ISC

