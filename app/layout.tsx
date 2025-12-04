import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TopScore Golf - AI Scorecard Analysis",
  description: "Upload your golf scorecard and get AI-powered insights and analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
