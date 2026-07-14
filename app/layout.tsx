import type { Metadata, Viewport } from 'next';
import { Inter, League_Spartan, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { cn } from "@/lib/utils";

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
});

const fontHeadline = League_Spartan({
  subsets: ["latin"],
  variable: "--font-headline",
  weight: ["700", "800", "900"],
});

const fontTechnical = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-technical",
  weight: ["300", "400", "500", "600", "700"],
});

export const viewport: Viewport = {
  themeColor: '#020817', // Match the dark background
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevents zooming on inputs in iOS
};

export const metadata: Metadata = {
  title: 'Bosmat Admin - Comprehensive Admin Dashboard',
  description: 'Admin dashboard for Bosmat Repaint and Detailing',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bosmat Admin',
  },
  formatDetection: {
    telephone: false,
  },
};

import { AuthProvider } from '@/lib/context/AuthContext';
import { MetaPixel } from '@/components/MetaPixel';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@100..900&family=Manrope:wght@200..800&display=swap" rel="stylesheet" />
      </head>
      <body className={cn(
        "min-h-screen bg-background font-body antialiased",
        fontSans.variable,
        fontHeadline.variable,
        fontTechnical.variable
      )}>
        <MetaPixel />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
