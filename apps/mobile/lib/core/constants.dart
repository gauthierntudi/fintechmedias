/// API de production par défaut (le site est déjà en ligne).
const kApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://api.entrevue.com/api',
);

const kCdnBaseUrl = 'https://cdn.entrevue.com';
const kSiteUrl = 'https://entrevue.com';

const kTurnstileSiteKey = String.fromEnvironment('TURNSTILE_SITE_KEY');

/// Client OAuth Web (serverClientId) — même valeur que GOOGLE_CLIENT_ID.
const kGoogleServerClientId = String.fromEnvironment('GOOGLE_CLIENT_ID');

/// Client OAuth iOS (Info.plist / GIDClientID), optionnel au runtime.
const kGoogleIosClientId = String.fromEnvironment('GOOGLE_IOS_CLIENT_ID');

const kBrandBlack = 0xFF111111;
const kBrandRed = 0xFFD63026;
const kBrandWhite = 0xFFFFFFFF;
/** Alias — anciens tokens navy / or / bleu. */
const kBrandNavy = kBrandBlack;
const kBrandGold = kBrandRed;
const kBrandBlue = kBrandBlack;

const kMagazineName = "L'Entrevue";

const kRubriques = <({String slug, String label, String tone})>[
  (slug: 'qu-en-dit-l-expert', label: "Qu'en dit l'expert", tone: 'teal'),
  (slug: 'rencontre-avec', label: 'Rencontre Avec', tone: 'gold'),
  (slug: 'entreprendre', label: 'Entreprendre', tone: 'red'),
  (slug: 'ecosysteme-pme', label: 'Écosystème PME', tone: 'blue'),
  (slug: 'femme', label: 'Femme', tone: 'dark'),
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
    'qu-en-dit-l-expert': 'teal',
    'rencontre-avec': 'gold',
    'entreprendre': 'red',
    'ecosysteme-pme': 'blue',
    'femme': 'dark',
    'stu-short': 'gold',
    'stu-talk': 'teal',
    'stu-stories': 'gold',
    'stu-news': 'red',
    'stu-data': 'blue',
    'stu-mag': 'dark',
    'edito': 'red',
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

bool isPortraitRubrique(String? slug) {
  final key = slug?.trim().toLowerCase() ?? '';
  return key == 'rencontre-avec' ||
      key == 'qu-en-dit-l-expert' ||
      key == 'stu-stories' ||
      key == 'stu-talk';
}

bool isShortRubrique(String? category, [String? label]) {
  bool match(String? value) {
    if (value == null) return false;
    final key = value.trim().toLowerCase();
    return key == 'stu-short' || key == 'short';
  }

  return match(category) || match(label);
}

bool isVideoRubrique(String? category, [String? label]) {
  bool match(String? value) {
    if (value == null) return false;
    final key = value.trim().toLowerCase();
    return key == 'rencontre-avec' ||
        key == 'rencontre avec' ||
        key == 'qu-en-dit-l-expert' ||
        key == "qu'en dit l'expert" ||
        key == 'stu-stories' ||
        key == 'stu stories' ||
        key == 'stu-talk' ||
        key == 'stu talk' ||
        key == 'stu-short' ||
        key == 'short' ||
        key == 'inspirationnel' ||
        key == 'game-changers' ||
        key == 'game-changer' ||
        key == 'grandes-entrevues' ||
        key == 'grande-entrevue' ||
        key == 'entrevue-croisee';
  }

  return match(category) || match(label);
}
