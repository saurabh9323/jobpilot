/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.licdn.com" },
      { protocol: "https", hostname: "**.glassdoor.com" },
      { protocol: "https", hostname: "logo.clearbit.com" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/gateway/:path*",
        destination: `${process.env.NEXT_PUBLIC_GATEWAY_URL}/api/:path*`,
      },
      {
        source: "/api/django/:path*",
        destination: `${process.env.NEXT_PUBLIC_DJANGO_URL}/api/:path*`,
      },
    ];
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": require("path").resolve(__dirname, "src"),
    };
    return config;
  },
};

module.exports = nextConfig;
