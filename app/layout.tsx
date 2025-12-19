import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TopScore Golf Scorecard Extractor",
  description: "AI-powered golf scorecard extractor and analyzer",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TopScore Golf Scorecard Extractor",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/Topscore_Logo-192.png",
    apple: "/Topscore_Logo-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/Topscore_Logo-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="TopScore Golf Scorecard Extractor" />
      </head>
      <body>{children}</body>
    </html>
  );
}
