import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/app-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  return [
    { url: `${base}/ar`, alternates: { languages: { ar: `${base}/ar`, en: `${base}/en` } } },
    { url: `${base}/en`, alternates: { languages: { ar: `${base}/ar`, en: `${base}/en` } } },
  ];
}
