"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function parseTime(value: string): { h: number; m: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

export type AdminTimePickerProps = {
  label: string;
  /** Heure au format `HH:MM` (ou chaîne vide). */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  clearable?: boolean;
  disabled?: boolean;
  /** Pas des minutes proposées (défaut : 5). */
  minuteStep?: number;
  /** Champ déjà wrappé : le parent affiche le label. */
  hideLabel?: boolean;
};

export function AdminTimePicker({
  label,
  value,
  onChange,
  placeholder = "--:--",
  className,
  clearable = true,
  disabled = false,
  minuteStep = 5,
  hideLabel = false,
}: AdminTimePickerProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const parsed = parseTime(value);

  const minutes = Array.from(
    { length: Math.ceil(60 / minuteStep) },
    (_, i) => i * minuteStep,
  );
  // Une minute hors pas (ex. 09:07 importé) reste sélectionnable.
  if (parsed && !minutes.includes(parsed.m)) {
    minutes.push(parsed.m);
    minutes.sort((a, b) => a - b);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        rootRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const pop = popoverRef.current;
    const trigger = triggerRef.current;
    if (!pop || !trigger) return;

    function place() {
      if (!pop || !trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = pop.offsetWidth;
      const height = pop.offsetHeight;
      let left = rect.left;
      let top = rect.bottom + 6;
      if (left + width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - width - 8);
      }
      if (top + height > window.innerHeight - 8) {
        const above = rect.top - height - 6;
        top = above >= 8 ? above : Math.max(8, window.innerHeight - height - 8);
      }
      pop.style.top = `${top}px`;
      pop.style.left = `${left}px`;
      pop.style.visibility = "visible";
    }

    place();
    // Centre l’heure / la minute sélectionnée dans chaque colonne.
    for (const col of [hoursRef.current, minutesRef.current]) {
      const sel = col?.querySelector<HTMLElement>(".is-selected");
      if (col && sel) {
        col.scrollTop = sel.offsetTop - col.clientHeight / 2 + sel.offsetHeight / 2;
      }
    }
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  function pickHour(h: number) {
    onChange(`${pad(h)}:${pad(parsed?.m ?? 0)}`);
  }

  function pickMinute(m: number) {
    onChange(`${pad(parsed?.h ?? 9)}:${pad(m)}`);
    setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        hideLabel
          ? "admin-datepicker admin-timepicker"
          : "admin-dash__field admin-dash__field--date admin-datepicker admin-timepicker",
        className,
      )}
    >
      {hideLabel ? null : <span id={`${id}-label`}>{label}</span>}
      <div className="admin-datepicker__wrap">
        <button
          ref={triggerRef}
          type="button"
          id={id}
          disabled={disabled}
          className={cn(
            "admin-datepicker__trigger admin-timepicker__trigger",
            !parsed && "is-empty",
            open && "is-open",
          )}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-labelledby={hideLabel ? undefined : `${id}-label`}
          aria-label={hideLabel ? label : undefined}
          onClick={() => setOpen((v) => !v)}
        >
          <Clock size={15} strokeWidth={2} aria-hidden />
          <span>{parsed ? `${pad(parsed.h)}:${pad(parsed.m)}` : placeholder}</span>
        </button>
        {clearable && open && value ? (
          <button
            type="button"
            className="admin-datepicker__clear"
            aria-label="Effacer l’heure"
            onClick={() => onChange("")}
          >
            <X size={13} strokeWidth={2} aria-hidden />
          </button>
        ) : null}

        {open
          ? createPortal(
              <div
                ref={popoverRef}
                className="admin-datepicker__popover admin-datepicker__popover--fixed admin-timepicker__popover"
                role="dialog"
                aria-label={`Heure — ${label}`}
              >
                <div className="admin-timepicker__cols">
                  <div className="admin-timepicker__col">
                    <p className="admin-timepicker__head">Heure</p>
                    <div ref={hoursRef} className="admin-timepicker__list">
                      {HOURS.map((h) => (
                        <button
                          key={h}
                          type="button"
                          className={cn(
                            "admin-timepicker__opt",
                            parsed?.h === h && "is-selected",
                          )}
                          onClick={() => pickHour(h)}
                        >
                          {pad(h)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="admin-timepicker__col">
                    <p className="admin-timepicker__head">Min</p>
                    <div ref={minutesRef} className="admin-timepicker__list">
                      {minutes.map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={cn(
                            "admin-timepicker__opt",
                            parsed?.m === m && "is-selected",
                          )}
                          onClick={() => pickMinute(m)}
                        >
                          {pad(m)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="admin-datepicker__footer">
                  <button
                    type="button"
                    className="admin-datepicker__today"
                    onClick={() => setOpen(false)}
                  >
                    OK
                  </button>
                </div>
              </div>,
              document.querySelector(".snow-dash") ?? document.body,
            )
          : null}
      </div>
    </div>
  );
}
