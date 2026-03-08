import type React from "react"
import type { Metadata } from "next"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"
import { ClerkProvider } from "@clerk/nextjs"
import { heILCustom } from "@/lib/he-IL"
import "./globals.css"
import { ErrorReporter } from "@/components/error-reporter"
import "../temp.ts"

export const metadata: Metadata = {
  title: 'לו"ז - סידור עבודה',
  description: "מערכת ניהול הסעות",
  generator: 'v0.app',
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/luz-favicon.png",
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider 
      localization={heILCustom}
      signInUrl="/sign-in"
      signInFallbackRedirectUrl="/"
    >
      <html lang="he" dir="rtl" suppressHydrationWarning>
        <body className="font-sans antialiased">
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            {children}
            <Toaster />
            <ErrorReporter />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
