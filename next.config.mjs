/** @type {import('next').NextConfig} */
const nextConfig = {
  // Let Node.js handle alasql natively (its react-native-fs dep breaks Turbopack)
  serverExternalPackages: ['alasql'],
};

export default nextConfig;
