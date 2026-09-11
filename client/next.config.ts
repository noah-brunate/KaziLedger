import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // FastAPI serves the generated HTML, JavaScript, CSS, and images directly.
  output: 'export',
};

export default nextConfig;
