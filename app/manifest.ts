import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "Kafeinmatcha Academy", short_name: "Kafeinmatcha",
    description: "Your trading education, community, and tools.",
    start_url: "/", scope: "/", display: "standalone",
    background_color: "#f6f2ea", theme_color: "#365c2a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
