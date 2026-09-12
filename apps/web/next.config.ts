import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/rubrique/stu-talk",
        destination: "/rubrique/qu-en-dit-l-expert",
        permanent: true,
      },
      {
        source: "/rubrique/stu-stories",
        destination: "/rubrique/rencontre-avec",
        permanent: true,
      },
      {
        source: "/rubrique/stu-news",
        destination: "/rubrique/entreprendre",
        permanent: true,
      },
      {
        source: "/rubrique/stu-data",
        destination: "/rubrique/ecosysteme-pme",
        permanent: true,
      },
      {
        source: "/rubrique/stu-mag",
        destination: "/kiosque",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.lentrevuemag.com",
      },
      {
        protocol: "https",
        hostname: "cdn.entrevue.com",
      },
      {
        protocol: "https",
        hostname: "cdn.egouv.online",
      },
      {
        protocol: "https",
        hostname: "cdn.opt1mum.com",
      },
    ],
  },
};

export default nextConfig;
