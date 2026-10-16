import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Krillion PH | Deep Trench Trivia',
  description: 'How deep can your Pinoy trivia pull go? Plankton to One in a Krillion.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-trench-abyss text-slate-100 antialiased selection:bg-krillion-gold selection:text-black">
        {children}
      </body>
    </html>
  );
}
