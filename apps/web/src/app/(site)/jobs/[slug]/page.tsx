import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  CalendarClock,
  ExternalLink,
  FileText,
  MapPin,
} from "lucide-react";
import { jobsPublicApi, type PublicJobDetail } from "@/lib/api";
import {
  JOB_CONTRACT_LABELS,
  JOB_SCHEMA_EMPLOYMENT,
  JOB_WORK_MODE_LABELS,
  formatJobDateLong,
  jobDeadlineState,
  jobPublishedAgo,
  parseJobDescription,
} from "@/lib/jobs";
import { BRAND } from "@/lib/brand";
import { absoluteMediaUrl, getSiteUrl, plainDescription } from "@/lib/site-url";
import { ArticleShare } from "@/components/site/article-share";
import { JobLogo, JobRow } from "../job-row";
import { JobApplyButton, JobViewTracker } from "./job-client";
import "../jobs.css";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string): Promise<PublicJobDetail | null> {
  try {
    return await jobsPublicApi.bySlug(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const job = await load(slug);
  if (!job) return { title: "Offre d’emploi", robots: { index: false } };
  const title = `${job.title} — ${job.companyName}`;
  const description =
    plainDescription(job.excerpt) ??
    `${JOB_CONTRACT_LABELS[job.contractType]} chez ${job.companyName}`;
  const url = `${getSiteUrl()}/jobs/${encodeURIComponent(job.slug)}`;
  const image = absoluteMediaUrl(job.companyLogoUrl);
  return {
    title,
    description,
    alternates: { canonical: url },
    // Une offre clôturée n’a plus vocation à être indexée.
    robots: job.isOpen ? undefined : { index: false },
    openGraph: {
      type: "website",
      locale: "fr_FR",
      siteName: BRAND.name,
      title,
      description,
      url,
      images: image ? [{ url: image }] : undefined,
    },
  };
}

function applyHref(job: PublicJobDetail): string | null {
  if (job.applyUrl) return job.applyUrl;
  if (job.applyEmail) {
    const subject = encodeURIComponent(`Candidature — ${job.title}`);
    return `mailto:${job.applyEmail}?subject=${subject}`;
  }
  return null;
}

/** JSON-LD schema.org/JobPosting (Google for Jobs). */
function jobJsonLd(job: PublicJobDetail) {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description ?? job.excerpt ?? job.title,
    datePosted: job.publishedAt ?? undefined,
    validThrough: job.deadline ?? undefined,
    employmentType: JOB_SCHEMA_EMPLOYMENT[job.contractType],
    hiringOrganization: {
      "@type": "Organization",
      name: job.companyName,
      sameAs: job.companyUrl ?? undefined,
      logo: absoluteMediaUrl(job.companyLogoUrl) ?? undefined,
    },
    jobLocationType: job.workMode === "REMOTE" ? "TELECOMMUTE" : undefined,
    jobLocation: job.locations.map((l) => ({
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: l },
    })),
    directApply: false,
    url: `${getSiteUrl()}/jobs/${encodeURIComponent(job.slug)}`,
  };
}

export default async function JobPage({ params }: Props) {
  const { slug } = await params;
  const job = await load(slug);
  if (!job) notFound();

  const pageUrl = `${getSiteUrl()}/jobs/${encodeURIComponent(job.slug)}`;
  const state = jobDeadlineState(job.deadline, job.isOpen);
  // Éditeur riche → HTML ; anciennes offres en texte simple → blocs.
  const isHtml = /<[a-z][\s\S]*>/i.test(job.description ?? "");
  const blocks = isHtml ? [] : parseJobDescription(job.description);
  const href = applyHref(job);
  const ago = jobPublishedAgo(job.publishedAt);
  let applyHost: string | null = null;
  try {
    applyHost = job.applyUrl
      ? new URL(job.applyUrl).hostname.replace(/^www\./, "")
      : null;
  } catch {
    applyHost = null;
  }
  const shareTitle = `${job.title} — ${job.companyName}`;

  return (
    <main className="opt-jobs opt-jobs--detail">
      <JobViewTracker slug={job.slug} />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jobJsonLd(job)).replace(/</g, "\\u003c"),
        }}
      />

      <Link href="/jobs" className="opt-jobs__back">
        <ArrowLeft size={16} aria-hidden /> Toutes les offres
      </Link>

      <header className="opt-job-hero">
        <JobLogo
          name={job.companyName}
          url={job.companyLogoUrl}
          bg={job.companyLogoBg}
          size="lg"
        />
        <div>
          <p className="opt-job-hero__tags">
            <span className="opt-job-tag opt-job-tag--contract">
              {JOB_CONTRACT_LABELS[job.contractType]}
            </span>
            <span className="opt-job-tag">
              {JOB_WORK_MODE_LABELS[job.workMode]}
            </span>
            <span className={`opt-job-tag opt-job-tag--${state.tone}`}>
              {state.label}
            </span>
          </p>
          <h1>{job.title}</h1>
          <p className="opt-job-hero__company">
            {job.companyUrl ? (
              <a
                href={job.companyUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {job.companyName}
                <ExternalLink size={14} aria-hidden />
              </a>
            ) : (
              job.companyName
            )}
            {ago ? <> · {ago}</> : null}
          </p>
        </div>
      </header>

      <div className="opt-job-layout">
        <div>
          {!job.isOpen ? (
            <p className="opt-job-closed">
              Cette offre est clôturée : la date limite de candidature est
              dépassée.
            </p>
          ) : null}
          <section className="opt-job-section">
            <h2>Description de l’offre</h2>
            {isHtml ? (
              <div
                className="opt-job-prose"
                // HTML nettoyé côté API (liste blanche de balises, jobs.service › richText)
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: job.description ?? "" }}
              />
            ) : blocks.length ? (
              <div className="opt-job-prose">
                {blocks.map((b, i) =>
                  b.type === "h" ? (
                    <h3 key={i}>{b.text}</h3>
                  ) : b.type === "ul" ? (
                    <ul key={i}>
                      {b.items.map((item, j) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p key={i}>{b.text}</p>
                  ),
                )}
              </div>
            ) : (
              <p className="opt-job-apply__note">
                Consultez l’offre complète sur le site du recruteur.
              </p>
            )}
          </section>
        </div>

        <aside className="opt-job-layout__aside" aria-label="Résumé de l’offre">
          <div className="opt-job-card">
            <dl className="opt-job-facts">
              <div>
                <FileText size={18} aria-hidden />
                <dt>Type de contrat</dt>
                <dd>{JOB_CONTRACT_LABELS[job.contractType]}</dd>
              </div>
              <div>
                <MapPin size={18} aria-hidden />
                <dt>{job.locations.length > 1 ? "Lieux" : "Lieu"}</dt>
                <dd>
                  {job.locations.length ? (
                    <ul>
                      {job.locations.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  ) : job.workMode === "REMOTE" ? (
                    "Télétravail"
                  ) : (
                    "À préciser"
                  )}
                </dd>
              </div>
              <div>
                <Briefcase size={18} aria-hidden />
                <dt>Mode de travail</dt>
                <dd>{JOB_WORK_MODE_LABELS[job.workMode]}</dd>
              </div>
              <div>
                <CalendarClock size={18} aria-hidden />
                <dt>Date limite</dt>
                <dd>
                  {job.deadline ? (
                    <time dateTime={job.deadline}>
                      {formatJobDateLong(job.deadline)}
                    </time>
                  ) : (
                    "Jusqu’à pourvoi du poste"
                  )}
                  {job.deadline ? (
                    <small>
                      <span
                        className={`opt-job-tag opt-job-tag--${state.tone}`}
                      >
                        {state.label}
                      </span>
                    </small>
                  ) : null}
                </dd>
              </div>
            </dl>

            <div className="opt-job-apply">
              {!job.isOpen ? (
                <span className="opt-job-cta is-disabled" aria-disabled>
                  Candidatures closes
                </span>
              ) : href ? (
                <>
                  <JobApplyButton slug={job.slug} href={href} />
                  <small>
                    {applyHost ? (
                      <>
                        Formulaire externe · {applyHost}
                        <ExternalLink size={12} aria-hidden />
                      </>
                    ) : (
                      <>Candidature par e-mail · {job.applyEmail}</>
                    )}
                  </small>
                </>
              ) : (
                <p className="opt-job-apply__note">
                  Les modalités de candidature figurent dans la description de
                  l’offre.
                </p>
              )}
            </div>
          </div>

          <div className="opt-job-card opt-job-share">
            <ArticleShare url={pageUrl} title={shareTitle} />
          </div>
        </aside>
      </div>

      {job.related?.length ? (
        <section className="opt-job-related" aria-labelledby="job-related">
          <h2 id="job-related">Autres offres</h2>
          <ul className="opt-jobs__list">
            {job.related.map((r) => (
              <li key={r.id}>
                <JobRow job={r} compact />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {job.isOpen && href ? (
        <div className="opt-job-sticky">
          <div>
            <strong>{job.title}</strong>
            {job.companyName}
          </div>
          <JobApplyButton slug={job.slug} href={href} />
        </div>
      ) : null}
    </main>
  );
}
