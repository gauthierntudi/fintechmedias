import "./home-skeleton.css";

function Bone({ className = "" }: { className?: string }) {
  return <span className={`opt-home-skel__bone ${className}`.trim()} />;
}

function SectionHead() {
  return (
    <div className="opt-home-skel__head">
      <Bone className="opt-home-skel__line opt-home-skel__line--title" />
      <Bone className="opt-home-skel__line opt-home-skel__line--more" />
    </div>
  );
}

function TopSkel() {
  return (
    <section className="opt-home-skel__top" aria-hidden>
      <div className="opt-home-skel__top-grid">
        <article className="opt-home-skel__lead">
          <Bone className="opt-home-skel__lead-media" />
          <div className="opt-home-skel__lead-copy">
            <Bone className="opt-home-skel__bone--on-color opt-home-skel__line opt-home-skel__line--lg" />
            <Bone className="opt-home-skel__bone--on-color opt-home-skel__line opt-home-skel__line--lg" />
            <Bone className="opt-home-skel__bone--on-color opt-home-skel__line" />
            <Bone className="opt-home-skel__bone--on-color opt-home-skel__line opt-home-skel__line--meta" />
          </div>
        </article>
        {Array.from({ length: 4 }, (_, i) => (
          <article key={i} className="opt-home-skel__card">
            <Bone className="opt-home-skel__card-media" />
            <Bone className="opt-home-skel__line" />
            <Bone className="opt-home-skel__line opt-home-skel__line--sm" />
            <Bone className="opt-home-skel__line opt-home-skel__line--meta" />
          </article>
        ))}
      </div>
    </section>
  );
}

function ForYouSkel() {
  return (
    <section className="opt-home-skel__fy" aria-hidden>
      <div className="opt-home-skel__fy-grid">
        <div className="opt-home-skel__fy-main">
          <SectionHead />
          <div className="opt-home-skel__fy-body">
            <article>
              <Bone className="opt-home-skel__fy-lead" />
              <Bone className="opt-home-skel__line opt-home-skel__line--lg" />
              <Bone className="opt-home-skel__line" />
              <Bone className="opt-home-skel__line opt-home-skel__line--meta" />
            </article>
            <div className="opt-home-skel__fy-minis">
              {Array.from({ length: 4 }, (_, i) => (
                <article key={i} className="opt-home-skel__mini">
                  <Bone className="opt-home-skel__mini-thumb" />
                  <div className="opt-home-skel__mini-copy">
                    <Bone className="opt-home-skel__line" />
                    <Bone className="opt-home-skel__line opt-home-skel__line--sm" />
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="opt-home-skel__block">
            <SectionHead />
            <div className="opt-home-skel__news">
              {Array.from({ length: 6 }, (_, i) => (
                <article key={i}>
                  <Bone className="opt-home-skel__news-media" />
                  <Bone className="opt-home-skel__line" />
                  <Bone className="opt-home-skel__line opt-home-skel__line--sm" />
                  <Bone className="opt-home-skel__line opt-home-skel__line--meta" />
                </article>
              ))}
            </div>
          </div>

          <div className="opt-home-skel__block">
            <SectionHead />
            <div className="opt-home-skel__split">
              <Bone className="opt-home-skel__split-media" />
              <div className="opt-home-skel__split-copy">
                <Bone className="opt-home-skel__bone--on-color opt-home-skel__line opt-home-skel__line--meta" />
                <Bone className="opt-home-skel__bone--on-color opt-home-skel__line opt-home-skel__line--lg" />
                <Bone className="opt-home-skel__bone--on-color opt-home-skel__line" />
                <Bone className="opt-home-skel__bone--on-color opt-home-skel__line opt-home-skel__line--sm" />
              </div>
            </div>
            <div className="opt-home-skel__split-cards">
              {Array.from({ length: 3 }, (_, i) => (
                <article key={i}>
                  <Bone className="opt-home-skel__news-media" />
                  <Bone className="opt-home-skel__line" />
                  <Bone className="opt-home-skel__line opt-home-skel__line--meta" />
                </article>
              ))}
            </div>
          </div>
        </div>

        <aside className="opt-home-skel__fy-side">
          <Bone className="opt-home-skel__line opt-home-skel__line--title" />
          {Array.from({ length: 2 }, (_, i) => (
            <article key={i}>
              <Bone className="opt-home-skel__must-media" />
              <Bone className="opt-home-skel__line" />
              <Bone className="opt-home-skel__line opt-home-skel__line--sm" />
            </article>
          ))}
        </aside>
      </div>
    </section>
  );
}

function KiosqueSkel() {
  return (
    <section className="opt-home-skel__kiosque" aria-hidden>
      <div className="opt-home-skel__wrap">
        <div className="opt-home-skel__kiosque-head">
          <Bone className="opt-home-skel__line opt-home-skel__line--title" />
          <Bone className="opt-home-skel__line opt-home-skel__line--more" />
        </div>
        <div className="opt-home-skel__kiosque-rail">
          {Array.from({ length: 6 }, (_, i) => (
            <article key={i} className="opt-home-skel__mag">
              <Bone className="opt-home-skel__mag-cover" />
              <Bone className="opt-home-skel__line" />
              <Bone className="opt-home-skel__line opt-home-skel__line--meta" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function RubriqueSkel() {
  return (
    <section className="opt-home-skel__rub" aria-hidden>
      <div className="opt-home-skel__rub-inner">
        <div>
          <SectionHead />
          <div className="opt-home-skel__rub-body">
            <Bone className="opt-home-skel__rub-feat" />
            <div className="opt-home-skel__rub-grid">
              {Array.from({ length: 4 }, (_, i) => (
                <article key={i}>
                  <Bone className="opt-home-skel__rub-thumb" />
                  <Bone className="opt-home-skel__line" />
                  <Bone className="opt-home-skel__line opt-home-skel__line--meta" />
                </article>
              ))}
            </div>
          </div>
        </div>
        <aside className="opt-home-skel__rub-side">
          <Bone className="opt-home-skel__line opt-home-skel__line--title" />
          <Bone className="opt-home-skel__rub-side-feat" />
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="opt-home-skel__pv">
              <Bone className="opt-home-skel__pv-thumb" />
              <div className="opt-home-skel__pv-body">
                <Bone className="opt-home-skel__line opt-home-skel__line--meta" />
                <Bone className="opt-home-skel__line" />
              </div>
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}

function NewsletterSkel() {
  return (
    <section className="opt-home-skel__newsletter" aria-hidden>
      <div className="opt-home-skel__newsletter-inner">
        <Bone className="opt-home-skel__bone--on-color opt-home-skel__line opt-home-skel__line--meta" />
        <Bone className="opt-home-skel__bone--on-color opt-home-skel__line opt-home-skel__line--lg" />
        <Bone className="opt-home-skel__bone--on-color opt-home-skel__line" />
        <Bone className="opt-home-skel__bone--on-color opt-home-skel__newsletter-field" />
      </div>
    </section>
  );
}

function PortraitSkel() {
  return (
    <section className="opt-home-skel__portrait" aria-hidden>
      <div className="opt-home-skel__portrait-hero">
        <div className="opt-home-skel__portrait-copy">
          <Bone className="opt-home-skel__bone--on-color opt-home-skel__line opt-home-skel__line--meta" />
          <Bone className="opt-home-skel__bone--on-color opt-home-skel__line opt-home-skel__line--lg" />
          <Bone className="opt-home-skel__bone--on-color opt-home-skel__line opt-home-skel__line--lg" />
          <Bone className="opt-home-skel__bone--on-color opt-home-skel__line" />
          <Bone className="opt-home-skel__bone--on-color opt-home-skel__line opt-home-skel__line--sm" />
          <Bone className="opt-home-skel__bone--on-color opt-home-skel__line opt-home-skel__line--more" />
        </div>
        <div className="opt-home-skel__portrait-dots">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={i === 0 ? "is-active" : undefined} />
          ))}
        </div>
      </div>
      <div className="opt-home-skel__portrait-cta">
        <Bone className="opt-home-skel__line opt-home-skel__line--title" />
        <Bone className="opt-home-skel__line" />
        <div className="opt-home-skel__portrait-actions">
          <Bone className="opt-home-skel__portrait-btn" />
          <Bone className="opt-home-skel__portrait-btn" />
        </div>
      </div>
    </section>
  );
}

export function HomeSkeleton() {
  return (
    <div className="opt-home-skel" aria-busy="true" aria-label="Chargement">
      <TopSkel />
      <ForYouSkel />
      <KiosqueSkel />
      <RubriqueSkel />
      <NewsletterSkel />
      <RubriqueSkel />
      <PortraitSkel />
      <KiosqueSkel />
    </div>
  );
}
