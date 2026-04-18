/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.licdn.com" },
      { protocol: "https", hostname: "logo.clearbit.com" },
    ],
  },
  async rewrites() {
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:4000";
    const djangoUrl  = process.env.NEXT_PUBLIC_DJANGO_URL  || "http://localhost:8000";
    return [
      { source: "/api/gateway/:path*", destination: `${gatewayUrl}/api/:path*` },
      { source: "/api/django/:path*",  destination: `${djangoUrl}/api/:path*`  },
    ];
  },
};

module.exports = nextConfig;
