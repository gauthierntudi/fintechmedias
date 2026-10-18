import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/rubrique/stu-talk",
        destination: "/rubrique/interview",
        permanent: true,
      },
      {
        source: "/rubrique/stu-stories",
        destination: "/rubrique/interview",
        permanent: true,
      },
      {
        source: "/rubrique/stu-news",
        destination: "/rubrique/entreprise",
        permanent: true,
      },
      {
        source: "/rubrique/stu-data",
        destination: "/rubrique/economie",
        permanent: true,
      },
      {
        source: "/rubrique/qu-en-dit-l-expert",
        destination: "/rubrique/interview",
        permanent: true,
      },
      {
        source: "/rubrique/rencontre-avec",
        destination: "/rubrique/interview",
        permanent: true,
      },
      {
        source: "/rubrique/entreprendre",
        destination: "/rubrique/entreprise",
        permanent: true,
      },
      {
        source: "/rubrique/ecosysteme-pme",
        destination: "/rubrique/economie",
        permanent: true,
      },
      {
        source: "/rubrique/femme",
        destination: "/rubrique/portrait",
        permanent: true,
      },
      {
        source: "/rubrique/edito",
        destination: "/rubrique/portrait",
        permanent: true,
      },
      {
        source: "/rubrique/édito",
        destination: "/rubrique/portrait",
        permanent: true,
      },
      {
        source: "/rubrique/innovation",
        destination: "/rubrique/entreprise",
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
