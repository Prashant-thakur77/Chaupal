import { useEffect, useState } from "react";

import { LivingDiya } from "@/components/diya/LivingDiya";
import "@/chaupal/chaupal.css";

export function meta() {
  const title = "चौपाल · Chaupal";
  const description =
    "Calligraphy, rangoli and shatranj for Indian elders, driven by her own agent in her own language, with family at the same live board.";
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { name: "twitter:card", content: "summary" },
  ];
}

/**
 * The front door. One action: start. No account, no form; the household
 * begins with a signed guest session and the first screen is the activity.
 */
export default function Welcome() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div className="theme-chaupal ch-shell" data-theme="dusk">
      <main className="ch-root ch-stage ch-grain ch-welcome" data-testid="welcome">
        <header className="ch-topbar">
          <div className="ch-brand">
            <span className="ch-wordmark">चौपाल</span>
          </div>
          <nav className="ch-topnav" aria-label="Chaupal">
            <a className="ch-pill" href="/proof">प्रमाण · Proof</a>
          </nav>
        </header>
        <section className="ch-welcome-hero">
          <div className="ch-welcome-diya">{mounted ? <LivingDiya phase="ready" size="fill" language="hi" /> : null}</div>
          <h1 className="ch-display ch-welcome-title" lang="hi">
            गाँव की चौपाल,
            <br />
            आपकी स्क्रीन पर
          </h1>
          <p className="ch-welcome-en">The village square, on her screen.</p>
          <p className="ch-welcome-body" lang="hi">
            बस बोलिए। आपका साथी सुलेख लिखता है जिसे आप दोहराएँ, रंगोली बनाता है जिसमें आप रंग भरें, और आपके साथ शतरंज खेलता है,
            जबकि दूर बैठा परिवार उसी बिसात पर साथ होता है।
          </p>
          <div className="ch-welcome-actions">
            <a className="ch-mic" href="/api/household/start" data-testid="start">
              शुरू करें
            </a>
            <a className="ch-btn ch-btn-quiet" href="/api/household/start?lang=en" data-testid="start-en">
              Start in English
            </a>
          </div>
          <p className="ch-welcome-note">कोई खाता नहीं चाहिए। No account needed; camera and voice stay on this device.</p>
        </section>
        <section className="ch-welcome-three" aria-label="What happens here">
          <article>
            <h2 lang="hi">सुलेख</h2>
            <p>Say a phrase; the exact Devanagari, Gurmukhi, Tamil, Bengali or Urdu text appears, shaped letter by letter, for her to trace with a finger or in the air.</p>
          </article>
          <article>
            <h2 lang="hi">रंगोली · कोलम</h2>
            <p>A pulli kolam on a dot grid or a radial rangoli to trace, coloured by voice: “beech mein peela, bahar laal”.</p>
          </article>
          <article>
            <h2 lang="hi">शतरंज</h2>
            <p>Chess with Hindi pieces. “Ghode se uska oont maar do” moves the board; a grandson in another city can play the other side live.</p>
          </article>
        </section>
      </main>
    </div>
  );
}
