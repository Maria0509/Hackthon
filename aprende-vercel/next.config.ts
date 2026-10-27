import type { NextConfig } from 'next';
const config:NextConfig={
  experimental:{cpus:2},
  async headers(){return [{source:'/:path*',headers:[{key:'Referrer-Policy',value:'same-origin'},{key:'X-Content-Type-Options',value:'nosniff'}]}];}
};
export default config;
