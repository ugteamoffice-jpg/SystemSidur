import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl

  // הפניה מ-/ ל-/default
  if (url.pathname === '/') {
    return NextResponse.redirect(new URL('/default', req.url))
  }

  // שליפת tenant מהנתיב: /tenant-name/...
  const pathParts = url.pathname.split('/').filter(Boolean)
  const tenantId = pathParts[0] || 'default'

  // הוספת x-tenant-id header לכל הבקשות
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
