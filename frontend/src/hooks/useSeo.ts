import { useEffect } from "react";

interface Seo { title: string; description?: string; canonicalPath?: string; noindex?: boolean; jsonLd?: object }

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.content = content;
}

/** Sets title, description, canonical, Open Graph and optional JSON-LD for the current page. */
export function useSeo({ title, description, canonicalPath, noindex, jsonLd }: Seo) {
  useEffect(() => {
    const full = title.includes("HireHub") ? title : `${title} | HireHub`;
    document.title = full;
    setMeta("property", "og:title", full);
    if (description) { setMeta("name", "description", description); setMeta("property", "og:description", description); }
    setMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonicalPath) {
      if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
      link.href = window.location.origin + canonicalPath;
      setMeta("property", "og:url", link.href);
    } else link?.remove();

    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
    return () => { script?.remove(); };
  }, [title, description, canonicalPath, noindex, jsonLd]);
}
