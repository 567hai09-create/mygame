import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Cinzel, Barlow_Condensed } from 'next/font/google'
import { AuthProvider } from '@/lib/firebase/auth-context'
import './globals.css'

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['500', '700', '900'],
  variable: '--font-cinzel',
})

const barlow = Barlow_Condensed({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://ecard.pw'),
  title: 'E-CARD // Đế Vương Bài — Psychological Death-Match',
  description:
    'A Kaiji-inspired Emperor / Slave / Citizen psychological card death-match. Wager your life across 12 brutal rounds against Chairman Hyodo.',
  generator: 'v0.app',
  openGraph: {
    title: 'E-CARD // Đế Vương Bài',
    description: 'Thắng để lấy lại tên. Thua thì quay về hầm tối.',
    url: 'https://ecard.pw',
    siteName: 'E-CARD',
    type: 'website',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0a0805',
  userScalable: false,
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${cinzel.variable} ${barlow.variable}`}>
      <body className="antialiased bg-background">
        <AuthProvider>
          {children}
          <div className="crt-layer" aria-hidden="true" />
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </AuthProvider>
      </body>
    </html>
  )
}
