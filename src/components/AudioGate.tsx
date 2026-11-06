"use client";

import { useEffect } from "react";
import { site } from "@/config/site";
import { getAmbient } from "@/lib/audio/ambient";
import { entered, mountGate } from "@/lib/audio/entry";
import { mountSfx } from "@/lib/audio/sfx";
import type { SonidosUI } from "@/lib/contenido/tipos";

/**
 * Pantalla de entrada, arranque de la música y efectos de sonido. Se monta
 * una vez, en la portada. `sonidos` viene del contenido (lo que se configura
 * en el admin, o lo de site.ts).
 */
export default function AudioGate({ sonidos }: { sonidos: SonidosUI }) {
  useEffect(() => mountGate(site.audio, getAmbient(site.audio)), []);
  useEffect(() => mountSfx(getAmbient(site.audio), sonidos, entered), [sonidos]);
  return null;
}
