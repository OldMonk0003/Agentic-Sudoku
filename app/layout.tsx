import type { Metadata, Viewport } from 'next';
import { AgentBootstrap } from '@/tools/AgentBootstrap';
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
      <body className="min-h-dvh bg-ground text-ink-clue font-sans antialiased">
        {/*
          Renders nothing. It exists so the WebMCP registration module reaches
          the client bundle -- a server component's imports never do, and a
          static export has no server runtime to register from. Composition,
          not logic: see src/tools/AgentBootstrap.tsx.
        */}
        <AgentBootstrap />
        {children}
      </body>
    </html>
  );
}
