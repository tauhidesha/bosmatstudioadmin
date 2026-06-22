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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body className={cn(
        "min-h-screen bg-background font-body antialiased",
        fontSans.variable,
        fontHeadline.variable,
        fontTechnical.variable
      )}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
