import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Antojo PR",
    short_name: "Antojo PR",
    description: "Encuentra restaurantes por plato en Puerto Rico · Find restaurants by dish in Puerto Rico",
    start_url: "/es",
    scope: "/",
    display: "standalone",
    background_color: "#fbf7f1",
    theme_color: "#c8410b",
    lang: "es-PR",
    categories: ["food", "travel", "lifestyle"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
