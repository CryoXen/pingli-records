"use client";

import { useEffect } from "react";
import { site, type Release } from "@/config/site";
import { mountReleasePanel } from "@/lib/release-panel";

/** Panel de información de lanzamiento, a la derecha. Se abre desde los cuadros del lienzo. */
export default function ReleasePanel({ releases }: { releases: readonly Release[] }) {
  useEffect(() => mountReleasePanel(releases, site.stores, site.copy.panel), [releases]);
  return null;
}
