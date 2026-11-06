"use client";

import { useEffect } from "react";
import { site } from "@/config/site";
import { mountSecretHold } from "@/lib/acceso-secreto";
import { getAmbient } from "@/lib/audio/ambient";
import { entered } from "@/lib/audio/entry";
import { mountCycle } from "@/lib/ciclo";
import type { Prevision } from "@/lib/contenido/tipos";

/**
 * El ciclo de 3:33: la previsión (10 s, con su canción) y el regreso a
 * "entrar". `images` viene del contenido (Supabase o public/previsiones).
 * También la acción secreta:
 * mantener presionada la cuenta lleva al admin.
 */
export default function Ciclo({ images }: { images: readonly Prevision[] }) {
  useEffect(() => {
    const ambient = getAmbient(site.audio);
    const song = site.cycle.song;
    return mountCycle(site.cycle, images, entered, () => ambient.stop(), {
      // la canción de la previsión se descarga junto con la imagen y suena cuando aparece
      prepare: () => song && void ambient.loadCue(song.src),
      show: () => song && void ambient.playCue(song.src, song.gainDb),
    });
  }, [images]);
  useEffect(() => mountSecretHold(site.admin), []);
  return null;
}
