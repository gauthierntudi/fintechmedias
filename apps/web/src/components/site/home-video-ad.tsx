"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { PublicHomeVideo } from "@/lib/api";
import "./home-video-ad.css";

const FLOAT_AFTER_MS = 15_000;

type Props = {
  video: PublicHomeVideo | null;
  floatOnly?: boolean;
};

export function HomeVideoAd({ video, floatOnly = false }: Props) {
  const slotRef = useRef<HTMLElement>(null);
  const floatingRef = useRef(floatOnly);
  const closedRef = useRef(false);
  const [floating, setFloating] = useState(floatOnly);
  const [dismissed, setDismissed] = useState(false);
  const [lift, setLift] = useState(16);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function floatNow() {
    if (closedRef.current || floatingRef.current) return;
    floatingRef.current = true;
    setFloating(true);
  }

  useEffect(() => {
    if (floatOnly || !video) return;
    const timer = window.setTimeout(floatNow, FLOAT_AFTER_MS);
    const slot = slotRef.current;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      if (entry.boundingClientRect.bottom < 80) floatNow();
    });
    if (slot) observer.observe(slot);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [floatOnly, video]);

  useEffect(() => {
    if (!floating) return;
    function place() {
      const mag = document.querySelector(".opt-mag-float");
      if (
        !(mag instanceof HTMLElement) ||
        getComputedStyle(mag).display === "none"
      ) {
        setLift(16);
        return;
      }
      const rect = mag.getBoundingClientRect();
      if (rect.height < 8 || rect.bottom < 0) {
        setLift(16);
        return;
      }
      setLift(Math.round(window.innerHeight - rect.top + 12));
    }
    place();
    window.addEventListener("resize", place);
    const id = window.setInterval(place, 400);
    return () => {
      window.removeEventListener("resize", place);
      window.clearInterval(id);
    };
  }, [floating]);

  function closeFloat() {
    closedRef.current = true;
    floatingRef.current = false;
    if (floatOnly) {
      setDismissed(true);
      return;
    }
    setFloating(false);
  }

  if (!video || dismissed) return null;

  const href = video.websiteUrl?.trim() || "#";
  const src =
    `https://www.youtube.com/embed/${encodeURIComponent(video.youtubeId)}` +
    "?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1&controls=1";

  const player = (
    <div
      className={
        floating
          ? "opt-home-video__player opt-home-video__player--float"
          : "opt-home-video__player"
      }
      style={floating ? { bottom: lift } : undefined}
    >
      <iframe
        src={src}
        title={video.title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
      {floating ? (
        <>
          <button
            type="button"
            className="opt-home-video__close"
            onClick={closeFloat}
            aria-label="Fermer la vidéo"
          >
            <X size={14} strokeWidth={2.4} />
          </button>
          {href !== "#" ? (
            <a
              className="opt-home-video__cta"
              href={href}
              target="_blank"
              rel="noreferrer"
            >
              En savoir plus
            </a>
          ) : null}
        </>
      ) : null}
    </div>
  );

  return (
    <>
      <section
        ref={slotRef}
        className={`opt-home-video${floating ? " is-floating" : ""}`}
        aria-label={video.title}
        aria-hidden={floating || undefined}
      >
        {floating ? null : (
          <>
            <header className="opt-home-video__head">
              <div className="opt-home-video__copy">
                <h2>{video.title}</h2>
                {video.subtitle ? <p>{video.subtitle}</p> : null}
              </div>
              {href !== "#" ? (
                <a
                  className="opt-home-video__more"
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                >
                  En savoir plus
                </a>
              ) : null}
            </header>
            {player}
          </>
        )}
      </section>
      {floating && mounted
        ? createPortal(player, document.body)
        : null}
    </>
  );
}
