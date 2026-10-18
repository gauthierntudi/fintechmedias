/// API de production par défaut (le site est déjà en ligne).
const kApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://api.fintechmedias.com/api',
);

const kCdnBaseUrl = 'https://cdn.fintechmedias.com';
const kSiteUrl = 'https://fintechmedias.com';

const kTurnstileSiteKey = String.fromEnvironment('TURNSTILE_SITE_KEY');

/// Client OAuth Web (serverClientId) — même valeur que GOOGLE_CLIENT_ID.
const kGoogleServerClientId = String.fromEnvironment('GOOGLE_CLIENT_ID');

/// Client OAuth iOS (Info.plist / GIDClientID), optionnel au runtime.
const kGoogleIosClientId = String.fromEnvironment('GOOGLE_IOS_CLIENT_ID');

const kBrandBlack = 0xFF111111;
const kBrandRed = 0xFF4ED319;
const kBrandWhite = 0xFFFFFFFF;
/// Alias — anciens tokens navy / or / bleu.
const kBrandNavy = kBrandBlack;
const kBrandGold = kBrandRed;
const kBrandBlue = kBrandBlack;

const kMagazineName = "Fintech Médias";
const kBrandTagline = "Guide dans l’univers de la FinTech en Afrique.";

const kRubriques = <({String slug, String label, String tone})>[
  (slug: 'actualites', label: 'Actualités', tone: 'red'),
  (slug: 'interview', label: 'Interview', tone: 'gold'),
  (slug: 'economie', label: 'Économie', tone: 'blue'),
  (slug: 'politique', label: 'Politique', tone: 'teal'),
  (slug: 'international', label: 'Int’l', tone: 'dark'),
  (slug: 'portrait', label: 'Édito', tone: 'gold'),
  (slug: 'entreprise', label: 'Entreprise', tone: 'red'),
  (slug: 'events', label: 'Events', tone: 'teal'),
];

const kNewsRubriques = <({String slug, String label, String tone})>[
  ...kRubriques,
  (slug: 'stu-short', label: 'Shorts', tone: 'gold'),
];

String capitalizeLabel(String value) {
  final parts = value.trim().split(RegExp(r'[\s_-]+'));
  return [
    for (final part in parts)
      if (part.isNotEmpty)
        '${part[0].toUpperCase()}${part.substring(1).toLowerCase()}',
  ].join(' ');
}

String toneFromCategory(String? category, [String? label]) {
  final candidates = [category, label].whereType<String>().map(
    (v) => v.trim().toLowerCase().replaceAll('_', '-').replaceAll(' ', '-'),
  );

  const aliases = <String, String>{
    'actualites': 'red',
    'interview': 'gold',
    'economie': 'blue',
    'politique': 'teal',
    'international': 'dark',
    'portrait': 'gold',
    'entreprise': 'red',
    'events': 'teal',
    'stu-short': 'gold',
    'rencontre-avec': 'gold',
    'qu-en-dit-l-expert': 'gold',
    'ecosysteme-pme': 'blue',
    'femme': 'gold',
    'entreprendre': 'red',
    'innovation': 'red',
    'stu-talk': 'teal',
    'stu-stories': 'gold',
    'stu-news': 'red',
    'stu-data': 'blue',
    'stu-mag': 'dark',
    'edito': 'gold',
    'édito': 'gold',
    'start-up': 'red',
    'vus-sur-le-net': 'red',
    'zoom': 'red',
    'decryptages': 'blue',
    'decryptage': 'blue',
    'inspirationnel': 'gold',
    'game-changers': 'gold',
    'game-changer': 'gold',
    'grandes-entrevues': 'teal',
    'grande-entrevue': 'teal',
    'entrevue-croisee': 'teal',
  };

  for (final key in candidates) {
    if (key.isEmpty) continue;
    final mapped = aliases[key];
    if (mapped != null) return mapped;
    for (final r in kRubriques) {
      if (key == r.slug) return r.tone;
    }
  }
  return 'red';
}

/// Ancienne grille « portrait » réservée aux rubriques 100 % vidéo.
/// Interview n’en fait plus partie : articles texte ou vidéo au cas par cas.
bool isPortraitRubrique(String? slug) {
  final key = slug?.trim().toLowerCase() ?? '';
  return key == 'stu-short' || key == 'short';
}

bool isShortRubrique(String? category, [String? label]) {
  bool match(String? value) {
    if (value == null) return false;
    final key = value.trim().toLowerCase();
    return key == 'stu-short' || key == 'short';
  }

  return match(category) || match(label);
}

/// Rubrique 100 % vidéo (SHORT). Interview et les autres se jugent via [ArticleCard.hasReadyVideo].
bool isVideoRubrique(String? category, [String? label]) {
  bool match(String? value) {
    if (value == null) return false;
    final key = value.trim().toLowerCase();
    return key == 'stu-short' || key == 'short';
  }

  return match(category) || match(label);
}
