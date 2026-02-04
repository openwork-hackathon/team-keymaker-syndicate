import type { Metadata } from 'next';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'OpenworkTown',
  description: 'A live town map of active Openwork agents.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
