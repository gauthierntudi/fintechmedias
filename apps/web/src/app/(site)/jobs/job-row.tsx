import Link from "next/link";
import { Briefcase, CalendarClock, MapPin } from "lucide-react";
import type { PublicJobCard } from "@/lib/api";
import {
  JOB_COMPANY_SECTOR_LABELS,
  JOB_CONTRACT_LABELS,
  JOB_WORK_MODE_LABELS,
  companyInitials,
  formatJobDate,
  jobDeadlineState,
  jobLocationsLabel,
  jobPublishedAgo,
} from "@/lib/jobs";

export function JobLogo({
  name,
  url,
  bg,
  size = "md",
}: {
  name: string;
  url: string | null;
  /** Fond détecté sur le logo — prolonge l’image jusqu’aux bords du cadre */
  bg?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={`opt-job-logo${size === "md" ? "" : ` opt-job-logo--${size}`}`}
      aria-hidden
      style={url && bg ? { background: bg, borderColor: bg } : undefined}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" />
      ) : (
        companyInitials(name)
      )}
    </span>
  );
}

export function JobRow({
  job,
  compact = false,
}: {
  job: PublicJobCard;
  compact?: boolean;
}) {
  const href = `/jobs/${encodeURIComponent(job.slug)}`;
  const state = jobDeadlineState(job.deadline, job.isOpen);
  const ago = jobPublishedAgo(job.publishedAt);
  const urgent = job.isOpen && (state.tone === "soon" || state.tone === "last");

  const deadline = (
    <span
      className={`opt-job-item__deadline is-${state.tone}`}
      title={
        job.deadline
          ? `Date limite : ${formatJobDate(job.deadline)}`
          : undefined
      }
    >
      {job.deadline && job.isOpen ? (
        <CalendarClock size={13} strokeWidth={2} aria-hidden />
      ) : null}
      {state.label}
    </span>
  );

  return (
    <article
      className={`opt-job-item${job.isOpen ? "" : " is-closed"}${
        urgent ? " is-urgent" : ""
      }${compact ? " is-compact" : ""}`}
    >
      <JobLogo
        name={job.companyName}
        url={job.companyLogoUrl}
        bg={job.companyLogoBg}
        size="sm"
      />
      <div className="opt-job-item__main">
        <h2 className="opt-job-item__title">
          <Link href={href}>{job.title}</Link>
        </h2>
        <p className="opt-job-item__company">
          chez <strong>{job.companyName}</strong>
          {job.companySector ? (
            <>
              {" "}
              · <span>{JOB_COMPANY_SECTOR_LABELS[job.companySector]}</span>
            </>
          ) : null}
        </p>
        <ul className="opt-job-item__pills">
          <li className="opt-job-pill opt-job-pill--contract">
            {JOB_CONTRACT_LABELS[job.contractType]}
          </li>
          <li className="opt-job-pill">
            <MapPin size={13} strokeWidth={2} aria-hidden />
            {jobLocationsLabel(job.locations, job.workMode)}
          </li>
          <li className="opt-job-pill">
            <Briefcase size={13} strokeWidth={2} aria-hidden />
            {JOB_WORK_MODE_LABELS[job.workMode]}
          </li>
          {/* Écrans étroits : la date limite rejoint les pastilles. */}
          <li className="opt-job-item__deadline-pill">{deadline}</li>
        </ul>
      </div>
      <div className="opt-job-item__side">
        {!compact && ago ? (
          <span className="opt-job-item__ago">{ago}</span>
        ) : (
          <span />
        )}
        {deadline}
      </div>
    </article>
  );
}
