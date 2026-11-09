import { Suspense, lazy, useEffect, useState } from "react";

import "@/features/experience/experience.css";

const ChaupalExperience = lazy(() =>
  import("@/features/experience/components/chaupal-experience").then((m) => ({
    default: m.ChaupalExperience,
  })),
);

export function meta() {
  return [{ title: "Chaupal · base experience" }];
}

export default function BaseExperienceRoute() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <ChaupalExperience />
    </Suspense>
  );
}
