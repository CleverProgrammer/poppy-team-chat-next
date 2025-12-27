import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import './mobile.css'
import { AuthProvider } from './contexts/AuthContext'
import { DevModeProvider } from './contexts/DevModeContext'
import CapacitorProvider from './components/providers/CapacitorProvider'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#667eea',
}

export const metadata = {
  title: 'Poppy Chat',
  description: 'Team chat with AI-powered assistance',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Poppy Chat',
  },
  openGraph: {
    title: 'Poppy Chat - Come vibe with the team lol',
    description: 'Where work gets done and chaos is encouraged. Join the squad 🔥',
    images: [
      {
        url: 'https://i.imgur.com/FW8HVnX.jpeg',
        width: 1200,
        height: 630,
        alt: 'Poppy Chat Team',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Poppy Chat - Come vibe with the team lol',
    description: 'Where work gets done and chaos is encouraged. Join the squad 🔥',
    images: ['https://i.imgur.com/FW8HVnX.jpeg'],
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang='en'>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <DevModeProvider>
            <CapacitorProvider>{children}</CapacitorProvider>
          </DevModeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
