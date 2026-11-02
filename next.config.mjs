/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pdf-parse', 'mongodb'],
  poweredByHeader: false,
  outputFileTracingExcludes: {'*':['./.finn-data/**','./.env*','./tmp/**','./tests/**','./releases/**']},
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' }
      ,{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}
      ,{key:'Cross-Origin-Opener-Policy',value:'same-origin'}
      ,{key:'Content-Security-Policy',value:`default-src 'self'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV==='development'?" 'unsafe-eval'":''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'${process.env.NODE_ENV==='development'?' ws:':''}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`}
      ,...(process.env.NODE_ENV==='production'?[{key:'Strict-Transport-Security',value:'max-age=31536000; includeSubDomains'}]:[])
    ] },{source:'/api/:path*',headers:[{key:'Cache-Control',value:'private, no-store'}]}];
  }
};
export default nextConfig;
