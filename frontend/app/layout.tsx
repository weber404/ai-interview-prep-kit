import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Interview Prep Kit',
  description: 'Generate a structured interview preparation kit.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      {/* System font stack: keeps the build fully offline-capable. */}
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
