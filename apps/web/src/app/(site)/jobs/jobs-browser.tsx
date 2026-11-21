"use client";

import {
  MouseEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { BriefcaseBusiness, ChevronLeft, ChevronRight } from "lucide-react";
import { jobsPublicApi, type PublicJobListResponse } from "@/lib/api";
import {
  JobFilterPanel,
  JobSearchBar,
  JobSort,
  type JobsPatch,
} from "./job-controls";
import {
  EMPTY_JOBS_QUERY,
  JOBS_PAGE_SIZE,
  hasJobsFilters,
  jobsHref,
  jobsListParams,
  jobsPageItems,
  parseJobsPath,
  parseJobsQuery,
} from "./jobs-query";
import { JobRow } from "./job-row";

type Result = { href: string; data: PublicJobListResponse | null };

/**
 * Liste filtrable : l’URL reste la source de vérité (partageable, bouton
 * retour), mais un changement de filtre ne recharge pas la page — on pousse
 * l’URL dans l’historique et on interroge l’API côté client.
 */
export function JobsBrowser({
  initialHref,
  initialData,
  aside,
}: {
  initialHref: string;
  initialData: PublicJobListResponse | null;
  aside?: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Filtres dans le chemin (/jobs/cdi-cdd/teletravail), sinon anciens
  // paramètres (?contract=…) réécrits ensuite.
  const { state, page } = useMemo(() => {
    const segments = pathname
      .replace(/^\/jobs\/?/, "")
      .split("/")
      .filter(Boolean);
    return (
      (segments.length ? parseJobsPath(segments) : null) ??
      parseJobsQuery(new URLSearchParams(searchParams.toString()))
    );
  }, [pathname, searchParams]);
  const href = jobsHref(state, page);

  // Ancienne URL (?city=…, ?contract=…) → forme lisible, sans nouvelle entrée d’historique.
  useEffect(() => {
    if (location.pathname + location.search !== href) {
      window.history.replaceState(
        { ...history.state, __keepScroll: true },
        "",
        href,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cache = useRef(
    new Map<string, PublicJobListResponse | null>([[initialHref, initialData]]),
  );
  const [result, setResult] = useState<Result>({
    href: initialHref,
    data: initialData,
  });
  const listTop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cache.current.has(href)) {
      setResult({ href, data: cache.current.get(href) ?? null });
      return;
    }
    let cancelled = false;
    jobsPublicApi
      .list(jobsListParams(state, page))
      .then((data) => {
        cache.current.set(href, data);
        if (!cancelled) setResult({ href, data });
      })
      .catch(() => {
        if (!cancelled) setResult({ href, data: null });
      });
    return () => {
      cancelled = true;
    };
    // `state` et `page` sont entièrement décrits par `href`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href]);

  const navigate = useCallback(
    (next: string, scroll = false) => {
      if (next === href) return;
      window.history.pushState({ __keepScroll: true }, "", next);
      if (scroll) {
        listTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [href],
  );

  const onChange = useCallback(
    (patch: JobsPatch) => navigate(jobsHref({ ...state, ...patch }, 1)),
    [navigate, state],
  );

  const loading = result.href !== href;
  const data = result.data;
  const pageCount = data
    ? Math.max(1, Math.ceil(data.total / JOBS_PAGE_SIZE))
    : 1;
  const filtered = hasJobsFilters(state);

  /** Lien de page : clic simple sans rechargement, Ctrl/⌘-clic natif. */
  const pageLink = (p: number) => ({
    href: jobsHref(state, p),
    onClick: (e: MouseEvent<HTMLAnchorElement>) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      navigate(jobsHref(state, p), true);
    },
  });

  return (
    <>
      <JobSearchBar
        key={`${state.q}|${state.location}|${state.sector}`}
        state={state}
        locations={data?.locations ?? []}
        onChange={onChange}
      />

      <div className="opt-jobs__grid">
        <aside className="opt-jobs__filters-col" aria-label="Filtres">
          <JobFilterPanel
            state={state}
            facets={data?.facets}
            total={data?.total}
            loading={loading}
            onChange={onChange}
          />
        </aside>

        <div
          ref={listTop}
          className={`opt-jobs__main${loading ? " is-loading" : ""}`}
          aria-busy={loading}
        >
          <div className="opt-jobs__head">
            <p className="opt-jobs__count" aria-live="polite">
              {data ? (
                <>
                  <strong>{data.total}</strong>{" "}
                  {data.total > 1 ? "offres" : "offre"}
                  {state.when === "closed"
                    ? data.total > 1
                      ? " clôturées"
                      : " clôturée"
                    : ""}
                </>
              ) : null}
            </p>
            <JobSort state={state} onChange={onChange} />
          </div>

          {data === null ? (
            <p className="opt-jobs__empty">
              Les offres sont momentanément indisponibles. Réessayez dans un
              instant.
            </p>
          ) : data.items.length === 0 ? (
            <div className="opt-jobs__empty">
              <BriefcaseBusiness size={28} strokeWidth={1.6} aria-hidden />
              <p>
                {state.when === "open"
                  ? "Aucune offre ouverte pour ces critères."
                  : "Aucune offre clôturée pour ces critères."}
              </p>
              {filtered ? (
                <button
                  type="button"
                  className="opt-jobs__empty-reset"
                  onClick={() =>
                    navigate(
                      jobsHref({ ...EMPTY_JOBS_QUERY, when: state.when }),
                    )
                  }
                >
                  Effacer les filtres
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="opt-jobs__list">
              {data.items.map((job) => (
                <li key={job.id}>
                  <JobRow job={job} />
                </li>
              ))}
            </ul>
          )}

          {data && pageCount > 1 ? (
            <nav className="opt-jobs__pager" aria-label="Pagination">
              {page > 1 ? (
                <a {...pageLink(page - 1)} aria-label="Page précédente">
                  <ChevronLeft size={16} aria-hidden />
                </a>
              ) : null}
              {jobsPageItems(page, pageCount).map((p, i) =>
                p === "…" ? (
                  <span key={`gap-${i}`} className="opt-jobs__pager-gap">
                    …
                  </span>
                ) : (
                  <a
                    key={p}
                    {...pageLink(p)}
                    className={p === page ? "is-active" : undefined}
                    aria-current={p === page ? "page" : undefined}
                  >
                    {p}
                  </a>
                ),
              )}
              {page < pageCount ? (
                <a {...pageLink(page + 1)} aria-label="Page suivante">
                  <ChevronRight size={16} aria-hidden />
                </a>
              ) : null}
            </nav>
          ) : null}
        </div>

        {aside}
      </div>
    </>
  );
}
