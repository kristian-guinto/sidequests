import type { Metadata } from 'next';
import { VT323, Press_Start_2P, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const arcadeFont = VT323({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-arcade',
});

const pixelFont = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-pixel',
});

const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Krillion PH | Deep Trench Trivia',
  description: 'How deep can your Pinoy trivia pull go? Plankton to One in a Krillion in the Philippine Trench.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${arcadeFont.variable} ${pixelFont.variable} ${monoFont.variable}`}>
      <body className="bg-trench-abyss text-slate-100 antialiased selection:bg-krillion-gold selection:text-black min-h-screen">
        {children}
      </body>
    </html>
  );
}
