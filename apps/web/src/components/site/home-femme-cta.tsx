import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function HomeFemmeCta() {
  return (
    <div className="opt-femme__cta">
      <div className="opt-femme__cta-inner">
        <h2 className="opt-femme__cta-title">
          Des voix qui éclairent
          <br />
          le débat.
        </h2>
        <p className="opt-femme__cta-lead">
          Créez un compte pour suivre les parcours et les visages de la
          fintech et de l’entreprise.
        </p>
        <div className="opt-femme__cta-actions">
          <Link href="/inscription" className="opt-femme__cta-btn opt-femme__cta-btn--red">
            S&apos;inscrire
            <ArrowRight size={16} strokeWidth={2} aria-hidden />
          </Link>
          <Link href="/connexion" className="opt-femme__cta-btn opt-femme__cta-btn--black">
            Se connecter
            <ArrowRight size={16} strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
