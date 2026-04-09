/** @type {import('next').NextConfig} */
const BACKEND_URL = (process.env.BACKEND_URL || 'http://127.0.0.1:4000').replace(/\/+$/, '')

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['10.8.0.3', '10.8.0.6', '10.162.227.221', 'localhost', '127.0.0.1', '192.168.31.245'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/:path*`,
      },
    ]
  },
}

export default nextConfig
