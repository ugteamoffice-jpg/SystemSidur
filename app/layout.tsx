import type React from "react"
import type { Metadata } from "next"
import { Varela_Round } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"
import { ClerkProvider } from "@clerk/nextjs"
import { heILCustom } from "@/lib/he-IL"
import "./globals.css"
import { ErrorReporter } from "@/components/error-reporter"
import "../temp.ts"

const varelaRound = Varela_Round({
  weight: "400",
  subsets: ["latin", "hebrew"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: "מערכת ניהול",
  description: "מערכת ניהול הסעות",
  generator: 'v0.app'
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
        <body className={`${varelaRound.variable} font-sans antialiased`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            {children}
            <Toaster />
            <Analytics />
            <ErrorReporter />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
