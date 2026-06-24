import type { Metadata, Viewport } from 'next';
import { Barlow_Semi_Condensed, Work_Sans } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

const barlowSemiCondensed = Barlow_Semi_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-headline',
  display: 'swap',
});

const workSans = Work_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});
import { ThemeProvider } from '@/components/theme-provider';
import { CartProvider } from '@/lib/cart-context';
import { CustomerSupportButton } from '@/components/customer-support-button';
import { CartSheet } from '@/components/cart/cart-sheet';
import { SupabaseClientProvider } from '@/firebase';
import { PwaInstallPrompt, PwaNetworkStatus } from '@/components/pwa';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#186491' },
    { media: '(prefers-color-scheme: dark)', color: '#186491' },
  ],
};

export const metadata: Metadata = {
  title: {
    default: 'ICAG Online Classes & CITG Tuition Ghana | Profs Training Solutions',
    template: '%s | Profs Training Solutions',
  },
  description: 'Join students preparing for ICAG and CITG professional qualifications. Expert-led ICAG online classes, CITG exam prep, and practical study materials in Ghana.',
  keywords: [
    'ICAG online classes',
    'ICAG tuition Ghana',
    'CITG online classes',
    'CITG tuition provider Ghana',
    'ICAG exam prep',
    'CITG exam preparation',
    'ICAG Level 1',
    'ICAG Level 2',
    'ICAG Level 3',
    'ICAG past questions',
    'CITG past questions',
    'professional accounting education Ghana',
  ],
  authors: [{ name: 'Profs Training Solutions' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://profstrainingsolutions.com',
    siteName: 'Profs Training Solutions',
    title: 'ICAG Online Classes & CITG Tuition Ghana | Profs Training Solutions',
    description: 'Expert-led ICAG and CITG professional tuition in Ghana with flexible online classes and exam-focused preparation.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ICAG Online Classes & CITG Tuition Ghana | Profs Training Solutions',
    description: 'Expert-led ICAG and CITG tuition in Ghana with practical exam-focused learning.',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://profstrainingsolutions.com',
  },
  metadataBase: new URL('https://profstrainingsolutions.com'),
  applicationName: 'Profs Training Solutions',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Profs',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${barlowSemiCondensed.variable} ${workSans.variable}`}>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <SupabaseClientProvider>
            <CartProvider>
              {children}
              <CartSheet />
              <CustomerSupportButton />
              <PwaInstallPrompt />
              <PwaNetworkStatus />
              <Toaster />
            </CartProvider>
          </SupabaseClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
