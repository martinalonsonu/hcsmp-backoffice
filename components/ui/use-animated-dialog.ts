"use client";

import { useEffect, type RefObject } from "react";

/**
 * Abre y cierra un <dialog> nativo según `open`. Al cerrar marca `data-closing`,
 * espera a que termine la animación de salida (ver globals.css) y recién entonces lo cierra.
 */
export function useAnimatedDialog(ref: RefObject<HTMLDialogElement | null>, open: boolean) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      dialog.removeAttribute("data-closing");
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (!dialog.open) return;
    dialog.setAttribute("data-closing", "");
    const finish = () => {
      dialog.removeAttribute("data-closing");
      if (dialog.open) dialog.close();
    };
    const onEnd = (event: AnimationEvent) => {
      if (event.target === dialog && !event.pseudoElement) finish();
    };
    dialog.addEventListener("animationend", onEnd);
    // Respaldo por si el navegador no emite animationend.
    const fallback = window.setTimeout(finish, 500);
    return () => {
      dialog.removeEventListener("animationend", onEnd);
      window.clearTimeout(fallback);
    };
  }, [ref, open]);

  useEffect(() => {
    const dialog = ref.current;
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [ref]);
}
