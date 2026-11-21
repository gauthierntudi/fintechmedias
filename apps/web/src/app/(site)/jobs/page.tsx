import type { Metadata } from "next";
import {
  jobsPublicApi,
  type PublicJobCompany,
  type PublicJobListResponse,
} from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { getSiteUrl } from "@/lib/site-url";
import { CompanyDirectory } from "./company-directory";
import { JobsBrowser } from "./jobs-browser";
import { JobsHero } from "./jobs-hero";
import {
  hasJobsFilters,
  jobsHref,
  jobsListParams,
  parseJobsQuery,
} from "./jobs-query";
import "./jobs.css";

export const metadata: Metadata = {
  title: "Jobs",
  description: `Offres d’emploi, stages et missions dans la fintech, la banque et l’innovation en Afrique — sélectionnées par ${BRAND.name}.`,
  alternates: { canonical: `${getSiteUrl()}/jobs` },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { state, page } = parseJobsQuery(await searchParams);

  const [data, companies] = await Promise.all([
    jobsPublicApi
      .list(jobsListParams(state, page))
      .catch((): PublicJobListResponse | null => null),
    jobsPublicApi
      .companies()
      .then((r) => r.items)
      .catch((): PublicJobCompany[] => []),
  ]);

  return (
    <main className="opt-jobs">
      <JobsHero
        openJobs={
          state.when === "open" && !hasJobsFilters(state)
            ? (data?.total ?? null)
            : null
        }
        companies={companies.length}
      />

      <JobsBrowser
        initialHref={jobsHref(state, page)}
        initialData={data}
        aside={
          companies.length ? (
            <aside className="opt-jobs__aside">
              <CompanyDirectory companies={companies} />
            </aside>
          ) : null
        }
      />
    </main>
  );
}
