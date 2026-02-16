import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl

  // שליפת tenant
  let tenantId = 'UrbanTours'
  const pathParts = url.pathname.split('/').filter(Boolean)

  if (pathParts[0] === 'api') {
    // עבור API routes: שולפים tenant מ-query param או מ-Referer header
    tenantId = url.searchParams.get('tenant') || ''
    if (!tenantId) {
      const referer = req.headers.get('referer')
      if (referer) {
        try {
          const refUrl = new URL(referer)
          const refParts = refUrl.pathname.split('/').filter(Boolean)
          if (refParts[0] && refParts[0] !== 'api' && refParts[0] !== 'sign-in') {
            tenantId = refParts[0]
          }
        } catch {}
      }
    }
    if (!tenantId) tenantId = 'UrbanTours'
  } else {
    // עבור דפים רגילים: tenant מהנתיב
    tenantId = pathParts[0] || 'UrbanTours'
  }

  const response = NextResponse.next()
  response.headers.set('x-tenant-id', tenantId)

  if (!isPublicRoute(req)) {
    const { userId } = await auth()
    if (!userId) {
      const signInUrl = new URL('/sign-in', req.url)
      signInUrl.searchParams.set('redirect_url', req.url)
      return NextResponse.redirect(signInUrl)
    }
  }

  return response
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
