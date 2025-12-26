import type { Metadata } from 'next'
import { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Love U convert - WebP to PNG Converter | Free Image Converter',
  description: 'The best and most advanced way to convert WebP to PNG for free. Convert images between PNG, JPEG, SVG, GIF, BMP, TIFF, and more formats.',
  keywords: 'image converter, webp to png, png converter, jpeg converter, svg converter, free image converter',
  openGraph: {
    title: 'Love U convert - Free Image Converter',
    description: 'Convert images between multiple formats for free',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

