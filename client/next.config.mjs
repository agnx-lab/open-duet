/** @type {import('next').NextConfig} */
const apiPort = process.env.OPEN_DOTS_API_PORT || process.env.PORT || "8088";
const apiOrigin = `http://127.0.0.1:${apiPort}`;

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiOrigin}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
