import { useActionQuery } from "@agent-native/core/client/hooks";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { useLiveSession } from "@/chaupal/live";
import "@/chaupal/chaupal.css";

export function meta() {
  return [{ title: "चौपाल · एल्बम" }];
}

const KIND: Record<string, { hi: string; en: string }> = {
  sulekh: { hi: "सुलेख", en: "Sulekh" },
  rangoli: { hi: "रंगोली", en: "Rangoli" },
  kolam: { hi: "कोलम", en: "Kolam" },
  shatranj: { hi: "शतरंज", en: "Shatranj" },
};

/** Her album: one work per page, a large previous/next bar, nothing else. */
function Album() {
  const { lang } = useLiveSession();
  const q = useActionQuery("list-album", { limit: 60 });
  const items = (q.data as { items?: { id: string; kind: string; title: string; createdAt: string; sharedAt: string | null; imagePath: string }[] } | undefined)?.items ?? [];
  const [i, setI] = useState(0);
  const en = lang === "en";
  const item = items[i];
  return (
    <main className="ch-root ch-stage ch-grain ch-album" data-testid="album" data-count={items.length}>
      <header className="ch-topbar">
        <a className="ch-pill" href="/chaupal">
          <ArrowLeft aria-hidden size={22} /> {en ? "Back" : "वापस"}
        </a>
        <span className="ch-wordmark">{en ? "Album" : "एल्बम"}</span>
      </header>
      {item ? (
        <section className="ch-album-page">
          <figure className="ch-album-art">
            <img src={item.imagePath} alt={item.title} />
          </figure>
          <div className="ch-album-meta">
            <p className="ch-card-sub">{en ? KIND[item.kind]?.en : KIND[item.kind]?.hi}</p>
            <h1 className="ch-h2" lang="hi">{item.title}</h1>
            <p className="ch-card-sub">
              {new Date(item.createdAt).toLocaleDateString(en ? "en-IN" : "hi-IN", { day: "numeric", month: "long" })}
              {item.sharedAt ? (en ? " · sent to family" : " · परिवार को भेजा") : ""}
            </p>
          </div>
          <nav className="ch-album-pager" aria-label={en ? "Pages" : "पन्ने"}>
            <button type="button" className="ch-btn ch-btn-quiet" disabled={i === 0} onClick={() => setI(i - 1)}>
              <ChevronLeft aria-hidden size={24} /> {en ? "Previous" : "पिछला"}
            </button>
            <span>{i + 1} / {items.length}</span>
            <button type="button" className="ch-btn ch-btn-quiet" disabled={i >= items.length - 1} onClick={() => setI(i + 1)}>
              {en ? "Next" : "अगला"} <ChevronRight aria-hidden size={24} />
            </button>
          </nav>
        </section>
      ) : (
        <p className="ch-lead">{q.isLoading ? "…" : en ? "Nothing kept yet. Say “keep this in my album”." : "अभी कुछ नहीं रखा। कहिए “इसे एल्बम में रख दो”।"}</p>
      )}
    </main>
  );
}

export default function AlbumRoute() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="ch-boot" />;
  return (
    <div className="theme-chaupal ch-shell" data-theme="dusk">
      <Album />
    </div>
  );
}
