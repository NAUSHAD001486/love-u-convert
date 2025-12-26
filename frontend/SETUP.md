# Quick Setup Guide

## 1. Install Dependencies

```bash
cd frontend
npm install
```

## 2. Configure Environment

Create `.env.local` file in the `frontend` directory:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

For production, use your backend API URL:
```bash
NEXT_PUBLIC_API_BASE_URL=https://your-api-domain.com
```

## 3. Run Development Server

```bash
npm run dev
```

Visit: http://localhost:3000

## 4. Build for Production

```bash
npm run build
npm start
```

## 5. Deploy to Vercel

1. Push code to GitHub
2. Go to [Vercel](https://vercel.com)
3. Import your repository
4. Add environment variable: `NEXT_PUBLIC_API_BASE_URL`
5. Deploy!

## Troubleshooting

- **TypeScript errors**: Run `npm install` first to install all dependencies
- **Tailwind not working**: Ensure `postcss.config.js` and `tailwind.config.js` are in place
- **API connection issues**: Check `NEXT_PUBLIC_API_BASE_URL` in `.env.local`

