"use client";

import { useLayoutEffect, useState } from "react";

type Nav =
  | { id: number; kind: "init" }
  | { id: number; kind: "push" }
  | { id: number; kind: "pop"; y: number };

const memory = new Map<string, number>();

function makeKey() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Un clic ouvre la page en haut. Précédent et suivant retrouvent
 * la position de défilement de la page quittée.
 */
export function ScrollRestoration() {
  const [nav, setNav] = useState<Nav>({ id: 0, kind: "init" });

  useLayoutEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    let stamping = false;

    const stamp = () => {
      if (stamping) return;
      const state = history.state;
      if (!state || typeof state !== "object") return;
      const y = window.scrollY;
      const key =
        typeof state.__scrollKey === "string" ? state.__scrollKey : makeKey();
      memory.set(key, y);
      if (state.__scrollKey === key && state.__scrollY === y) return;
      stamping = true;
      origReplace({ ...state, __scrollKey: key, __scrollY: y }, "");
      stamping = false;
    };

    history.pushState = (state, title, url) => {
      const before = location.pathname + location.search;
      stamp();
      const result = origPush(state, title, url);
      const after = location.pathname + location.search;
      if (after !== before) {
        setNav((current) => ({ id: current.id + 1, kind: "push" }));
      }
      return result;
    };

    const onPop = (event: PopStateEvent) => {
      const state = event.state as
        | { __scrollKey?: string; __scrollY?: number }
        | null;
      const remembered =
        state?.__scrollKey && memory.has(state.__scrollKey)
          ? memory.get(state.__scrollKey)
          : undefined;
      const y =
        typeof remembered === "number"
          ? remembered
          : typeof state?.__scrollY === "number"
            ? state.__scrollY
            : 0;
      setNav((current) => ({ id: current.id + 1, kind: "pop", y }));
    };

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(stamp);
    };

    window.addEventListener("popstate", onPop);
    window.addEventListener("scroll", onScroll, { passive: true });
    stamp();

    return () => {
      history.pushState = origPush;
      cancelAnimationFrame(frame);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useLayoutEffect(() => {
    if (nav.kind === "init") return;

    if (nav.kind === "pop") {
      const y = nav.y;
      const start = performance.now();
      let frame = 0;
      const step = () => {
        const max = Math.max(
          0,
          document.documentElement.scrollHeight - window.innerHeight,
        );
        const target = Math.min(y, max);
        if (Math.abs(window.scrollY - target) > 2) {
          window.scrollTo(0, target);
        }
        const pageStillShort = y > 0 && max + 8 < y;
        if (pageStillShort && performance.now() - start < 800) {
          frame = requestAnimationFrame(step);
        }
      };
      step();
      return () => cancelAnimationFrame(frame);
    }

    if (location.hash.length > 1) {
      const el = document.getElementById(
        decodeURIComponent(location.hash.slice(1)),
      );
      if (el) {
        el.scrollIntoView();
        return;
      }
    }

    window.scrollTo(0, 0);
  }, [nav]);

  return null;
}
