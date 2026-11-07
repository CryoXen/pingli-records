"use client";

import { useEffect } from "react";
import { site } from "@/config/site";
import { getAmbient } from "@/lib/audio/ambient";
import { entered, mountGate } from "@/lib/audio/entry";
import { mountSfx } from "@/lib/audio/sfx";
import type { MusicaUI, SonidosUI } from "@/lib/contenido/tipos";

/**
 * Pantalla de entrada, arranque de la música y efectos de sonido. Se monta
 * una vez, en la portada. `musica` y `sonidos` vienen del contenido (lo que
 * se configura en el admin, o lo de site.ts).
 */
export default function AudioGate({ sonidos, musica }: { sonidos: SonidosUI; musica: MusicaUI }) {
  useEffect(() => {
    const ambient = getAmbient(site.audio);
    // la canción elegida para cada mundo (antes de entrar, para que se empiece a descargar)
    ambient.useTracks({ light: musica.fondo.claro, dark: musica.fondo.oscuro });
    return mountGate(site.audio, ambient);
  }, [musica]);
  useEffect(() => mountSfx(getAmbient(site.audio), sonidos, entered), [sonidos]);
  return null;
}
