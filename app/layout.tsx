import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agentic Sudoku',
  description: 'A Sudoku board you and an agent can solve together.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-ground text-ink-clue font-sans antialiased">{children}</body>
    </html>
  );
}
