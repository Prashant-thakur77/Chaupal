import { useEffect, useState } from "react";

import { FamilyView } from "@/chaupal/FamilyView";
import "@/chaupal/chaupal.css";

export function meta() {
  return [{ title: "Chaupal · live" }];
}

/**
 * The MCP App card: the same live session the family phone sees, rendered
 * inside a chat host (for example Claude). It never shows camera, audio or
 * the elder's conversation.
 */
export default function EmbedLive() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="ch-boot" />;
  return (
    <div className="theme-chaupal ch-shell ch-embed" data-theme="dusk">
      <FamilyView />
    </div>
  );
}
