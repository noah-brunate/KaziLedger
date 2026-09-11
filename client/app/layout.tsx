import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KaziLedger | Trusted professional services',
  description: 'Connect with vetted professionals, manage requests, and pay securely through protected escrow.',
  metadataBase: new URL('https://kaziledger-accounting-services.noahbrunate9.chatgpt.site'),
  openGraph: {
    title: 'KaziLedger | Trusted professional services',
    description: 'Find vetted professionals and protect service payments in escrow.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KaziLedger | Trusted professional services',
    description: 'Find vetted professionals and protect service payments in escrow.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
