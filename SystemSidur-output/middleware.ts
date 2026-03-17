import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// רק דפי התחברות הם public — כל השאר (כולל API) דורש auth
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl
  const pathParts = url.pathname.split('/').filter(Boolean)

  // שליפת tenant
  let tenantId = 'UrbanTours'
  if (pathParts[0] === 'api') {
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
    tenantId = pathParts[0] || 'UrbanTours'
  }

  // בדיקת auth — כל route שאינו public דורש התחברות
  if (!isPublicRoute(req)) {
    const { userId } = await auth()
    if (!userId) {
      // API route — החזר 401 במקום redirect
      if (pathParts[0] === 'api') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const signInUrl = new URL('/sign-in', req.url)
      signInUrl.searchParams.set('redirect_url', req.url)
      return NextResponse.redirect(signInUrl)
    }
  }

  const response = NextResponse.next()
  response.headers.set('x-tenant-id', tenantId)
  return response
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
