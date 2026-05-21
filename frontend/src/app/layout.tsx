import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/hooks/useAuth'
import { Navbar } from '@/components/layout/Navbar'
import { Toaster } from '@/components/ui/toaster'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export const metadata: Metadata = {
  title: 'AlgoArena - ACMer Toolbox',
  description: 'Your competitive programming companion',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `(function() {
            try {
              var t = localStorage.getItem('theme') || 'dark';
              document.documentElement.classList.toggle('dark', t === 'dark');
            } catch(e) {}
          })()`
        }} />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className="min-h-screen bg-background antialiased">
        <AuthProvider>
          <Navbar />
          <ErrorBoundary>
          <main className="mx-auto max-w-7xl px-4 py-6">
            {children}
          </main>
          </ErrorBoundary>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
