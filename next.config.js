/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: { '/api/**': ['./database/supabase-ca.crt'] },
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/auth/:path*",
        destination: "/api/auth/:path*",
      },
      {
        source: "/events",
        destination: "/api/events",
      },
      {
        source: "/events/:id",
        destination: "/api/events/:id",
      },
      {
        source: "/bets",
        destination: "/api/bets",
      },
      {
        source: "/bets/:userId",
        destination: "/api/bets/:userId",
      },
      {
        source: "/balance/deposit",
        destination: "/api/balance/deposit",
      },
      {
        source: "/balance/withdraw",
        destination: "/api/balance/withdraw",
      },
      {
        source: "/balance/:userId",
        destination: "/api/balance/:userId",
      },
      {
        source: "/reports",
        destination: "/api/reports",
      },
    ];
  },
};

module.exports = nextConfig;
