"use client";

import { useEffect, useRef } from "react";
import { site } from "@/config/site";
import { getAmbient } from "@/lib/audio/ambient";
import { mountVolumeSlider } from "@/lib/audio/volume-slider";

/**
 * Volumen, arriba a la izquierda (donde estaba "sello discográfico").
 * data-intro="2": aparece en la entrada animada justo después del nombre.
 */
export default function VolumeSlider() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!site.audio.enabled || !ref.current) return;
    return mountVolumeSlider(ref.current, getAmbient(site.audio), site.audio.copy.volume);
  }, []);

  if (!site.audio.enabled) return null;
  return <span ref={ref} className="vol" data-intro="2" />;
}
