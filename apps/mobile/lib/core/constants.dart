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

/// Client OAuth iOS (Info.plist / GIDClientID).
/// Accepte GOOGLE_CLIENT_ID_IOS ou GOOGLE_IOS_CLIENT_ID via --dart-define.
const kGoogleIosClientId = String.fromEnvironment(
  'GOOGLE_CLIENT_ID_IOS',
  defaultValue: String.fromEnvironment('GOOGLE_IOS_CLIENT_ID'),
);

const kBrandBlack = 0xFF111111;
const kBrandRed = 0xFF4ED319;
const kBrandWhite = 0xFFFFFFFF;

/// Alias — anciens tokens navy / or / bleu (chrome UI, pas les tones rubrique).
const kBrandNavy = kBrandBlack;
const kBrandGold = kBrandRed;
const kBrandBlue = kBrandBlack;

const kMagazineName = "Fintech Médias";
const kBrandTagline = "Premier média Africain spécialisé dans la FinTech.";

/// Une couleur unique par rubrique (vert charte + noir + palette distincte).
const kRubriques = <({String slug, String label, String tone})>[
  (slug: 'actualites', label: 'Actualités', tone: 'green'),
  (slug: 'interview', label: 'Interview', tone: 'gray'),
  (slug: 'economie', label: 'Économie', tone: 'blue'),
  (slug: 'politique', label: 'Politique', tone: 'teal'),
  (slug: 'international', label: 'Int’l', tone: 'violet'),
  (slug: 'portrait', label: 'Édito', tone: 'orange'),
  (slug: 'entreprise', label: 'Entreprise', tone: 'rose'),
];

const kNewsRubriques = <({String slug, String label, String tone})>[
  ...kRubriques,
  (slug: 'stu-short', label: 'Shorts', tone: 'cyan'),
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
    'actualites': 'green',
    'interview': 'gray',
    'economie': 'blue',
    'politique': 'teal',
    'international': 'violet',
    'portrait': 'orange',
    'entreprise': 'rose',
    // Ancienne rubrique Events → Actualités
    'events': 'green',
    'stu-short': 'cyan',
    // Legacy API tones → couleurs uniques
    'red': 'green',
    'dark': 'violet',
    'black': 'gray',
    'rencontre-avec': 'gray',
    'qu-en-dit-l-expert': 'gray',
    'ecosysteme-pme': 'blue',
    'femme': 'orange',
    'entreprendre': 'rose',
    'innovation': 'rose',
    'stu-talk': 'gray',
    'stu-stories': 'gray',
    'stu-news': 'rose',
    'stu-data': 'blue',
    'stu-mag': 'violet',
    'edito': 'orange',
    'édito': 'orange',
    'start-up': 'rose',
    'vus-sur-le-net': 'rose',
    'zoom': 'rose',
    'decryptages': 'blue',
    'decryptage': 'blue',
    'inspirationnel': 'gray',
    'game-changers': 'gray',
    'game-changer': 'gray',
    'grandes-entrevues': 'gray',
    'grande-entrevue': 'gray',
    'entrevue-croisee': 'gray',
  };

  for (final key in candidates) {
    if (key.isEmpty) continue;
    final mapped = aliases[key];
    if (mapped != null) return mapped;
    for (final r in kRubriques) {
      if (key == r.slug) return r.tone;
    }
  }
  return 'green';
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
