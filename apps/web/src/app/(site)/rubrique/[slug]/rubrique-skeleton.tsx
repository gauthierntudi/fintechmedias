import "./rubrique.css";

export function RubriqueSkeleton() {
  return (
    <div
      className="opt-rubrique opt-rubrique--red"
      aria-busy="true"
      aria-label="Chargement"
    >
      <div className="opt-rubrique__inner">
        <div className="opt-rubrique-skel__hero" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <span
              key={i}
              className="opt-rubrique__feed-skel-media opt-rubrique-skel__hero-card"
            />
          ))}
        </div>

        <section className="opt-rubrique__more" aria-hidden>
          <span className="opt-rubrique__feed-skel-line opt-rubrique-skel__heading" />
          <div className="opt-rubrique__more-layout">
            <div className="opt-rubrique__feed-skel">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="opt-rubrique__feed-skel-row">
                  <span className="opt-rubrique__feed-skel-media" />
                  <span className="opt-rubrique__feed-skel-body">
                    <span className="opt-rubrique__feed-skel-line opt-rubrique__feed-skel-line--title" />
                    <span className="opt-rubrique__feed-skel-line opt-rubrique__feed-skel-line--excerpt" />
                    <span className="opt-rubrique__feed-skel-line opt-rubrique__feed-skel-line--excerpt-short" />
                    <span className="opt-rubrique__feed-skel-line opt-rubrique__feed-skel-line--meta" />
                  </span>
                </div>
              ))}
            </div>

            <aside className="opt-rubrique-skel__side">
              <span className="opt-rubrique__feed-skel-line opt-rubrique-skel__side-title" />
              {Array.from({ length: 2 }, (_, i) => (
                <div key={i} className="opt-rubrique-skel__must">
                  <span className="opt-rubrique__feed-skel-media opt-rubrique-skel__must-media" />
                  <span className="opt-rubrique__feed-skel-line opt-rubrique__feed-skel-line--title" />
                  <span className="opt-rubrique__feed-skel-line opt-rubrique__feed-skel-line--excerpt-short" />
                </div>
              ))}
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}
