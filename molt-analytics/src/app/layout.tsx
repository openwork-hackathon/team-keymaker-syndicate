import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Molt Analytics - AI Agent Economy Dashboard',
  description: 'Real-time metrics and insights for the Molt ecosystem',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
