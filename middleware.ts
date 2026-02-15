import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// דפים פתוחים - רק דף ההתחברות
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  // אם זה לא דף פתוח - דרוש התחברות
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
