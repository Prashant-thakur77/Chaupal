import { useEffect, useState } from "react";

import { Stage } from "@/chaupal/Stage";
import "@/chaupal/chaupal.css";

export function meta() {
  return [
    { title: "चौपाल · Chaupal" },
    { name: "description", content: "Calligraphy, rangoli and shatranj for elders, with family at the same board." },
  ];
}

export default function ChaupalRoute() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="ch-root ch-stage" />;
  return (
    <div className="theme-chaupal ch-shell" data-theme="dusk">
      <Stage />
    </div>
  );
}
