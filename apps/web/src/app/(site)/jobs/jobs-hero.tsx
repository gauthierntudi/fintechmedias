import Image from "next/image";

/** Portraits flottants : position (% largeur / px), diamètre, délai d’animation. */
const AVATARS = [
  { src: "/avatars/person1.jpg", size: 132, left: 4, top: 18, delay: 0 },
  { src: "/avatars/person2.jpg", size: 104, left: 19, top: 112, delay: 1.2 },
  { src: "/avatars/person3.jpg", size: 84, left: 31, top: 6, delay: 2.1 },
  { src: "/avatars/person4.jpg", size: 148, left: 43, top: 60, delay: 0.6 },
  { src: "/avatars/person5.jpg", size: 78, left: 60, top: 14, delay: 1.7 },
  { src: "/avatars/person6.jpg", size: 108, left: 70, top: 96, delay: 0.9 },
  { src: "/avatars/person7.jpg", size: 86, left: 85, top: 30, delay: 2.4 },
] as const;

export function JobsHero({
  openJobs,
  companies,
}: {
  openJobs: number | null;
  companies: number;
}) {
  return (
    <header className="opt-jobs-hero">
      <div className="opt-jobs-hero__text">
        <p className="opt-jobs-hero__kicker">Carrières fintech</p>
        <h1>Trouvez votre prochain job dans la fintech</h1>
        <p className="opt-jobs-hero__lead">
          Emplois, stages et missions dans les paiements, la banque et
          l’innovation financière en Afrique — postulez directement auprès des
          recruteurs.
        </p>
        {openJobs !== null ? (
          <p className="opt-jobs-hero__stats">
            <span>
              <strong>{openJobs}</strong> offre{openJobs > 1 ? "s" : ""} ouverte
              {openJobs > 1 ? "s" : ""}
            </span>
            {companies ? (
              <span>
                <strong>{companies}</strong> entreprise
                {companies > 1 ? "s" : ""} qui recrute
                {companies > 1 ? "nt" : ""}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="opt-jobs-hero__people" aria-hidden>
        {AVATARS.map((a, i) => (
          <span
            key={a.src}
            className={`opt-jobs-hero__avatar opt-jobs-hero__avatar--${i + 1}`}
            style={{
              width: a.size,
              height: a.size,
              left: `${a.left}%`,
              top: a.top,
              animationDelay: `${a.delay}s`,
            }}
          >
            <Image
              src={a.src}
              alt=""
              fill
              sizes={`${a.size * 2}px`}
              priority={i < 4}
            />
          </span>
        ))}
      </div>
    </header>
  );
}
