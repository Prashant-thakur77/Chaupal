import { useEffect, useState } from "react";

import { FamilyView } from "@/chaupal/FamilyView";
import "@/chaupal/chaupal.css";

export function meta() {
  return [{ title: "चौपाल · परिवार" }];
}

export default function FamilyRoute() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="ch-root ch-stage" />;
  return (
    <div className="theme-chaupal ch-shell" data-theme="day">
      <FamilyView />
    </div>
  );
}
