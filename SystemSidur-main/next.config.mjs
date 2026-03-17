/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // מונע clickjacking — לא ניתן לטעון את האתר ב-iframe
          { key: "X-Frame-Options", value: "DENY" },
          // מונע MIME sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // מגביל referrer info
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // מונע גישה ל-sensitive browser features
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // HSTS — אחרי deploy על HTTPS (Railway מספק HTTPS)
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // Content Security Policy בסיסי
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.com https://*.clerk.accounts.dev https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://clerk.com https://*.clerk.accounts.dev https://teable-production-bedd.up.railway.app wss:",
              "frame-src 'self' https://clerk.com https://*.clerk.accounts.dev",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ]
  },
}

export default nextConfig
