import 'constants.dart';

String? _optionalUrl(Object? raw) {
  final s = raw is String ? raw.trim() : '';
  return s.isEmpty ? null : s;
}

class ArticleCard {
  const ArticleCard({
    required this.id,
    required this.slug,
    required this.title,
    this.excerpt,
    this.coverUrl,
    this.category,
    this.categoryLabel = '',
    this.categoryTone = 'green',
    this.authorName = 'Fintech Médias',
    this.authorAvatarUrl,
    this.dateLabel = '',
    this.videoHlsUrl,
    this.videoPosterUrl,
    this.videoStatus,
    this.videoDurationSec,
  });

  final String id;
  final String slug;
  final String title;
  final String? excerpt;
  final String? coverUrl;
  final String? category;
  final String categoryLabel;
  final String categoryTone;
  final String authorName;
  final String? authorAvatarUrl;
  final String dateLabel;
  final String? videoHlsUrl;
  final String? videoPosterUrl;
  final String? videoStatus;
  final int? videoDurationSec;

  bool get hasReadyVideo =>
      videoStatus == 'READY' && (videoHlsUrl?.isNotEmpty ?? false);

  String get durationLabel {
    final sec = videoDurationSec;
    if (sec == null || sec <= 0) return '';
    final minutes = (sec / 60).ceil().clamp(1, 9999);
    return '$minutes min';
  }

  String get durationClock {
    final sec = videoDurationSec;
    if (sec == null || sec <= 0) return '';
    final m = sec ~/ 60;
    final s = sec % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  /// Chapô brut, sans balises HTML.
  String get chapo {
    final raw = excerpt?.trim() ?? '';
    if (raw.isEmpty) return '';
    return raw
        .replaceAll(RegExp(r'<[^>]+>'), ' ')
        .replaceAll(RegExp(r'&nbsp;', caseSensitive: false), ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&quot;', '"')
        .replaceAll(RegExp(r'&#39;|&apos;'), "'")
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  factory ArticleCard.fromJson(Map<String, dynamic> json) {
    return ArticleCard(
      id: '${json['id']}',
      slug: '${json['slug'] ?? json['id']}',
      title: '${json['title'] ?? ''}',
      excerpt: json['excerpt'] as String?,
      coverUrl: json['coverUrl'] as String?,
      category: json['category'] as String?,
      categoryLabel: '${json['categoryLabel'] ?? json['category'] ?? ''}',
      categoryTone: '${json['categoryTone'] ?? 'green'}',
      authorName:
          '${json['authorName'] ?? json['author']?['name'] ?? 'Fintech Médias'}',
      authorAvatarUrl: _optionalUrl(
        json['authorAvatarUrl'] ?? json['author']?['avatarUrl'],
      ),
      dateLabel: '${json['dateLabel'] ?? ''}',
      videoHlsUrl: json['videoHlsUrl'] as String?,
      videoPosterUrl: json['videoPosterUrl'] as String?,
      videoStatus: json['videoStatus'] as String?,
      videoDurationSec: (json['videoDurationSec'] as num?)?.toInt(),
    );
  }
}

class ArticleBlock {
  const ArticleBlock({this.title, this.coverUrl, required this.content});

  final String? title;
  final String? coverUrl;
  final String content;

  factory ArticleBlock.fromJson(Map<String, dynamic> json) {
    return ArticleBlock(
      title: json['title'] as String?,
      coverUrl: json['coverUrl'] as String?,
      content: '${json['content'] ?? ''}',
    );
  }
}

class ArticleDetail {
  const ArticleDetail({
    required this.id,
    required this.slug,
    required this.title,
    this.excerpt,
    this.coverUrl,
    this.category,
    this.categoryLabel,
    this.categoryTone,
    this.authorName,
    this.authorAvatarUrl,
    this.publishedAt,
    this.videoHlsUrl,
    this.videoPosterUrl,
    this.videoStatus,
    this.content = '',
    this.blocks = const [],
  });

  final String id;
  final String slug;
  final String title;
  final String? excerpt;
  final String? coverUrl;
  final String? category;
  final String? categoryLabel;
  final String? categoryTone;
  final String? authorName;
  final String? authorAvatarUrl;
  final String? publishedAt;
  final String? videoHlsUrl;
  final String? videoPosterUrl;
  final String? videoStatus;
  final String content;
  final List<ArticleBlock> blocks;

  bool get hasReadyVideo =>
      videoStatus == 'READY' && (videoHlsUrl?.isNotEmpty ?? false);

  factory ArticleDetail.fromJson(Map<String, dynamic> json) {
    final author = json['author'];
    final byline = json['bylineAuthor'];
    final authorMap = author is Map
        ? Map<String, dynamic>.from(author)
        : byline is Map
        ? Map<String, dynamic>.from(byline)
        : null;
    final blocks =
        (json['blocks'] as List?)
            ?.whereType<Map>()
            .map((b) => ArticleBlock.fromJson(Map<String, dynamic>.from(b)))
            .toList() ??
        const <ArticleBlock>[];
    final name = (authorMap?['name'] as String?)?.trim();
    final avatar =
        (authorMap?['avatarUrl'] as String?)?.trim() ??
        (json['authorAvatarUrl'] as String?)?.trim();
    return ArticleDetail(
      id: '${json['id']}',
      slug: '${json['slug'] ?? ''}',
      title: '${json['title'] ?? ''}',
      excerpt: json['excerpt'] as String?,
      coverUrl: json['coverUrl'] as String?,
      category: json['category'] as String?,
      categoryLabel: json['categoryLabel'] as String?,
      categoryTone: json['categoryTone'] as String?,
      authorName: (name != null && name.isNotEmpty)
          ? name
          : (json['authorName'] as String?),
      authorAvatarUrl: (avatar != null && avatar.isNotEmpty) ? avatar : null,
      publishedAt: json['publishedAt'] as String?,
      videoHlsUrl: json['videoHlsUrl'] as String?,
      videoPosterUrl: json['videoPosterUrl'] as String?,
      videoStatus: json['videoStatus'] as String?,
      content: '${json['content'] ?? ''}',
      blocks: blocks,
    );
  }
}

class HomeFeed {
  const HomeFeed({
    this.featured = const [],
    this.topGrid = const [],
    this.actualites = const [],
    this.interview = const [],
    this.economie = const [],
    this.politique = const [],
    this.international = const [],
    this.portrait = const [],
    this.entreprise = const [],
  });

  final List<ArticleCard> featured;
  final List<ArticleCard> topGrid;
  final List<ArticleCard> actualites;
  final List<ArticleCard> interview;
  final List<ArticleCard> economie;
  final List<ArticleCard> politique;
  final List<ArticleCard> international;
  final List<ArticleCard> portrait;
  final List<ArticleCard> entreprise;

  List<ArticleCard> forSlug(String slug) {
    return switch (slug) {
      'actualites' => actualites,
      'interview' => interview,
      'economie' => economie,
      'politique' => politique,
      'international' => international,
      'portrait' => portrait,
      'entreprise' => entreprise,
      _ => const <ArticleCard>[],
    };
  }

  factory HomeFeed.fromJson(Map<String, dynamic> json) {
    List<ArticleCard> list(String key) =>
        (json[key] as List?)
            ?.whereType<Map>()
            .map((e) => ArticleCard.fromJson(Map<String, dynamic>.from(e)))
            .toList() ??
        const [];
    List<ArticleCard> pick(String key, [String? fallback]) {
      if (json.containsKey(key)) return list(key);
      return fallback == null ? const [] : list(fallback);
    }

    return HomeFeed(
      featured: list('featured'),
      topGrid: list('topGrid'),
      actualites: pick('actualites', 'ecosystemePme'),
      interview: pick('interview', 'rencontreAvec'),
      economie: pick('economie', 'innovation'),
      politique: pick('politique'),
      international: pick('international', 'expert'),
      portrait: pick('portrait', 'femme'),
      entreprise: pick('entreprise', 'entreprendre'),
    );
  }
}

class CategoryFeed {
  const CategoryFeed({
    required this.category,
    required this.label,
    required this.tone,
    required this.items,
    this.mostRead = const [],
    this.total = 0,
  });

  final String category;
  final String label;
  final String tone;
  final List<ArticleCard> items;
  final List<ArticleCard> mostRead;
  final int total;

  factory CategoryFeed.fromJson(Map<String, dynamic> json) {
    List<ArticleCard> list(String key) =>
        (json[key] as List?)
            ?.whereType<Map>()
            .map((e) => ArticleCard.fromJson(Map<String, dynamic>.from(e)))
            .toList() ??
        const [];
    return CategoryFeed(
      category: '${json['category'] ?? ''}',
      label: '${json['label'] ?? ''}',
      tone: '${json['tone'] ?? 'teal'}',
      items: list('items'),
      mostRead: list('mostRead'),
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }
}

class Subscriber {
  const Subscriber({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.country,
    this.address,
    this.avatarUrl,
    this.emailVerified = false,
  });

  final String id;
  final String name;
  final String email;
  final String? phone;
  final String? country;
  final String? address;
  final String? avatarUrl;
  final bool emailVerified;

  factory Subscriber.fromJson(Map<String, dynamic> json) {
    return Subscriber(
      id: '${json['id']}',
      name: '${json['name'] ?? ''}',
      email: '${json['email'] ?? ''}',
      phone: json['phone'] as String?,
      country: json['country'] as String?,
      address: json['address'] as String?,
      avatarUrl: _absoluteAvatar(json['avatarUrl'] as String?),
      emailVerified: json['emailVerified'] == true,
    );
  }

  /// L'API renvoie parfois un chemin relatif (`/legacy/profil/…`) servi par le site.
  static String? _absoluteAvatar(String? raw) {
    final v = raw?.trim() ?? '';
    if (v.isEmpty) return null;
    if (v.startsWith('http://') || v.startsWith('https://')) return v;
    return '$kSiteUrl${v.startsWith('/') ? '' : '/'}$v';
  }
}

class AppSettings {
  const AppSettings({
    this.captcha = false,
    this.turnstileSiteKey = '',
    this.googleClientId = '',
    this.googleIosClientId = '',
  });

  final bool captcha;
  final String turnstileSiteKey;
  final String googleClientId;
  final String googleIosClientId;

  factory AppSettings.fromJson(Map<String, dynamic> json) {
    return AppSettings(
      captcha: json['captcha'] == true,
      turnstileSiteKey: '${json['turnstileSiteKey'] ?? ''}',
      googleClientId: '${json['googleClientId'] ?? ''}',
      googleIosClientId: '${json['googleIosClientId'] ?? ''}',
    );
  }
}

class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  final String accessToken;
  final String refreshToken;
  final Subscriber user;

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    final userJson = json['user'] is Map
        ? Map<String, dynamic>.from(json['user'] as Map)
        : json;
    return AuthSession(
      accessToken: '${json['accessToken'] ?? ''}',
      refreshToken: '${json['refreshToken'] ?? ''}',
      user: Subscriber.fromJson(userJson),
    );
  }
}

class MagazineCard {
  const MagazineCard({
    required this.id,
    required this.title,
    this.issueNumber,
    this.coverUrl,
    this.dateLabel = '',
    this.priceCents,
    this.currency = 'USD',
    this.accessType,
    this.description,
    this.bgColor,
    this.accentColor,
  });

  final String id;
  final String title;
  final String? issueNumber;
  final String? coverUrl;
  final String dateLabel;
  final int? priceCents;
  final String currency;
  final String? accessType;
  final String? description;
  final String? bgColor;
  final String? accentColor;

  bool get isFree => accessType == 'FREE';

  factory MagazineCard.fromJson(Map<String, dynamic> json) {
    return MagazineCard(
      id: '${json['id']}',
      title: '${json['title'] ?? ''}',
      issueNumber: json['issueNumber'] as String?,
      coverUrl: json['coverUrl'] as String?,
      dateLabel: '${json['dateLabel'] ?? ''}',
      priceCents: (json['priceCents'] as num?)?.toInt(),
      currency: '${json['currency'] ?? 'USD'}',
      accessType: json['accessType'] as String?,
      description: json['description'] as String?,
      bgColor: json['theme'] is Map
          ? json['theme']['bgColor'] as String?
          : json['bgColor'] as String?,
      accentColor: json['theme'] is Map
          ? json['theme']['accentColor'] as String?
          : json['accentColor'] as String?,
    );
  }
}

class MagazinePage {
  const MagazinePage({
    required this.pageNumber,
    required this.url,
    this.thumbUrl,
  });

  final int pageNumber;
  final String url;
  final String? thumbUrl;

  factory MagazinePage.fromJson(Map<String, dynamic> json) {
    return MagazinePage(
      pageNumber: (json['pageNumber'] as num?)?.toInt() ?? 0,
      url: '${json['url'] ?? ''}',
      thumbUrl: json['thumbUrl'] as String?,
    );
  }
}

class MagazineSession {
  const MagazineSession({
    required this.id,
    required this.title,
    required this.canRead,
    this.preview = false,
    this.maxPages,
    this.accessVia,
    this.accessType,
    this.message,
    this.pages = const [],
  });

  final String id;
  final String title;
  final bool canRead;
  final bool preview;
  final int? maxPages;
  final String? accessVia;
  final String? accessType;
  final String? message;
  final List<MagazinePage> pages;

  factory MagazineSession.fromJson(Map<String, dynamic> json) {
    return MagazineSession(
      id: '${json['id']}',
      title: '${json['title'] ?? ''}',
      canRead: json['canRead'] == true,
      preview: json['preview'] == true,
      maxPages: (json['maxPages'] as num?)?.toInt(),
      accessVia: json['accessVia'] as String?,
      accessType: json['accessType'] as String?,
      message: json['message'] as String?,
      pages:
          (json['pages'] as List?)
              ?.whereType<Map>()
              .map((e) => MagazinePage.fromJson(Map<String, dynamic>.from(e)))
              .toList() ??
          const [],
    );
  }
}

class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    this.body,
    this.read = false,
    this.createdAt,
  });

  final String id;
  final String title;
  final String? body;
  final bool read;
  final String? createdAt;

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: '${json['id'] ?? json['notificationId'] ?? ''}',
      title: '${json['title'] ?? json['subject'] ?? 'Notification'}',
      body: (json['body'] ?? json['message'] ?? json['text']) as String?,
      read: json['read'] == true || json['isRead'] == true,
      createdAt: json['createdAt'] as String?,
    );
  }
}

class PurchaseItem {
  const PurchaseItem({
    required this.id,
    required this.title,
    this.coverUrl,
    this.magazineId,
  });

  final String id;
  final String title;
  final String? coverUrl;
  final String? magazineId;

  factory PurchaseItem.fromJson(Map<String, dynamic> json) {
    final mag = json['magazine'];
    return PurchaseItem(
      id: '${json['id']}',
      title: mag is Map
          ? '${mag['title'] ?? json['title'] ?? 'Magazine'}'
          : '${json['title'] ?? 'Achat'}',
      coverUrl: mag is Map
          ? mag['coverUrl'] as String?
          : json['coverUrl'] as String?,
      magazineId: mag is Map ? '${mag['id']}' : json['magazineId'] as String?,
    );
  }
}

/// Diapo d’un statut : image, vidéo, texte et/ou raccourci article.
class StatusSlide {
  const StatusSlide({
    required this.id,
    this.mediaType,
    this.mediaUrl,
    this.posterUrl,
    this.imageFit = 'COVER',
    this.caption,
    this.linkUrl,
    this.durationSec = 6,
    this.article,
  });

  final String id;

  /// 'IMAGE' | 'VIDEO' | null (raccourci article / texte)
  final String? mediaType;
  final String? mediaUrl;
  final String? posterUrl;

  /// 'COVER' (plein écran) | 'FIT' (image entière)
  final String imageFit;
  final String? caption;

  /// Lien externe (bouton « En savoir plus »), surtout pour les statuts abonnés
  final String? linkUrl;
  final int durationSec;
  final ArticleCard? article;

  bool get isVideo => mediaType == 'VIDEO' && (mediaUrl?.isNotEmpty ?? false);
  bool get isImage => mediaType == 'IMAGE' && (mediaUrl?.isNotEmpty ?? false);
  bool get fitsImage => isImage && imageFit == 'FIT';

  /// Image représentant la diapo (bulle, préchargement).
  String? get thumbUrl {
    if (isImage) return mediaUrl;
    if (isVideo) return posterUrl ?? article?.coverUrl;
    return article?.coverUrl;
  }

  factory StatusSlide.fromJson(
    Map<String, dynamic> json, {
    String? fallbackId,
  }) {
    final rawArticle = json['article'];
    final link = (json['linkUrl'] as String?)?.trim();
    return StatusSlide(
      id: '${json['id'] ?? fallbackId}',
      mediaType: json['mediaType'] as String?,
      mediaUrl: json['mediaUrl'] as String?,
      posterUrl: json['posterUrl'] as String?,
      imageFit: json['imageFit'] == 'FIT' ? 'FIT' : 'COVER',
      caption: json['caption'] as String?,
      linkUrl: link == null || link.isEmpty ? null : link,
      durationSec: (json['durationSec'] as num?)?.toInt() ?? 6,
      article: rawArticle is Map
          ? ArticleCard.fromJson(Map<String, dynamic>.from(rawArticle))
          : null,
    );
  }
}

/// Statut éphémère (bulle en tête de l’accueil) : une ou plusieurs diapos.
/// Publié par la rédaction, ou par un abonné (payant → « Sponsorisé »).
class StatusItem {
  const StatusItem({
    required this.id,
    this.title,
    required this.slides,
    required this.publishedAt,
    required this.expiresAt,
    this.sponsored = false,
    this.authorName,
    this.authorAvatarUrl,
  });

  final String id;

  /// Titre choisi (null = déduit des diapos).
  final String? title;
  final List<StatusSlide> slides;
  final DateTime publishedAt;
  final DateTime expiresAt;

  /// Statut publié par un abonné (payant)
  final bool sponsored;
  final String? authorName;
  final String? authorAvatarUrl;

  StatusSlide get first => slides.first;

  /// Image affichée dans la bulle.
  String? get thumbUrl => first.thumbUrl;

  bool get isVideo => first.isVideo;

  /// Libellé court sous la bulle.
  String get label {
    if (title != null) return title!;
    if (authorName != null && authorName!.trim().isNotEmpty) {
      return authorName!.trim();
    }
    for (final slide in slides) {
      final text = slide.caption?.trim();
      if (text != null && text.isNotEmpty) return text;
    }
    for (final slide in slides) {
      final a = slide.article;
      if (a != null && a.categoryLabel.isNotEmpty) return a.categoryLabel;
    }
    return 'Fintech Médias';
  }

  factory StatusItem.fromJson(Map<String, dynamic> json) {
    final id = '${json['id']}';
    final rawSlides = json['slides'];
    final slides = rawSlides is List
        ? rawSlides
              .whereType<Map>()
              .map((s) => StatusSlide.fromJson(Map<String, dynamic>.from(s)))
              .toList()
        // Ancien format (une seule diapo à plat)
        : [StatusSlide.fromJson(json, fallbackId: id)];
    final rawTitle = (json['title'] as String?)?.trim();
    final author = json['author'];
    return StatusItem(
      id: id,
      title: rawTitle == null || rawTitle.isEmpty ? null : rawTitle,
      slides: slides.isEmpty
          ? [StatusSlide.fromJson(json, fallbackId: id)]
          : slides,
      publishedAt:
          DateTime.tryParse('${json['publishedAt']}')?.toLocal() ??
          DateTime.now(),
      expiresAt:
          DateTime.tryParse('${json['expiresAt']}')?.toLocal() ??
          DateTime.now().add(const Duration(hours: 24)),
      sponsored: json['sponsored'] == true,
      authorName: author is Map ? author['name'] as String? : null,
      authorAvatarUrl: author is Map ? author['avatarUrl'] as String? : null,
    );
  }
}

/// Offre de publication d’un statut abonné : publication unique ou forfait.
class StatusOffer {
  const StatusOffer({
    required this.id,
    required this.kind,
    required this.label,
    this.description,
    required this.priceCents,
    required this.currency,
    required this.statusLifetimeHours,
    this.quota,
    this.periodDays,
  });

  final String id;

  /// 'SINGLE' | 'PASS'
  final String kind;
  final String label;
  final String? description;
  final int priceCents;
  final String currency;
  final int statusLifetimeHours;

  /// PASS : statuts inclus (null = illimité)
  final int? quota;

  /// PASS : validité en jours
  final int? periodDays;

  bool get isPass => kind == 'PASS';

  String get priceLabel => formatStatusPrice(priceCents, currency);

  /// Durée d’affichage d’un statut publié avec ce tarif (« 24 h », « 3 jours »).
  String get lifetimeLabel =>
      statusLifetimeHours % 24 == 0 && statusLifetimeHours >= 48
      ? '${statusLifetimeHours ~/ 24} jours'
      : '$statusLifetimeHours h';

  /// Ex. « visible 24 h » / « 10 statuts · 30 jours »
  String get detail {
    final life = lifetimeLabel;
    if (!isPass) return 'Visible $life';
    final count = quota == null ? 'Statuts illimités' : '$quota statuts';
    return '$count · ${periodDays ?? 30} jours · visible $life chacun';
  }

  factory StatusOffer.fromJson(Map<String, dynamic> json) => StatusOffer(
    id: '${json['id']}',
    kind: '${json['kind'] ?? 'SINGLE'}',
    label: '${json['label'] ?? ''}',
    description: json['description'] as String?,
    priceCents: (json['priceCents'] as num?)?.toInt() ?? 0,
    currency: '${json['currency'] ?? 'USD'}',
    statusLifetimeHours: (json['statusLifetimeHours'] as num?)?.toInt() ?? 24,
    quota: (json['quota'] as num?)?.toInt(),
    periodDays: (json['periodDays'] as num?)?.toInt(),
  );
}

String formatStatusPrice(int cents, String currency) {
  final major = cents / 100;
  final amount = major == major.roundToDouble()
      ? major.toStringAsFixed(0)
      : major.toStringAsFixed(2);
  return '$amount ${currency.toUpperCase()}';
}

/// Forfaits « Statuts » de l’abonné connecté.
class StatusPasses {
  const StatusPasses({
    required this.hasActivePass,
    this.remaining,
    this.activeUntil,
  });

  /// Au moins un forfait actif avec des publications restantes
  final bool hasActivePass;

  /// Publications restantes (null = illimité)
  final int? remaining;

  /// Fin du forfait actif le plus long
  final DateTime? activeUntil;

  factory StatusPasses.fromJson(Map<String, dynamic> json) {
    DateTime? until;
    final items = json['items'];
    if (items is List) {
      for (final p in items.whereType<Map>()) {
        if (p['active'] != true) continue;
        final d = DateTime.tryParse('${p['expiresAt']}')?.toLocal();
        if (d != null && (until == null || d.isAfter(until))) until = d;
      }
    }
    return StatusPasses(
      hasActivePass: json['hasActivePass'] == true,
      remaining: (json['remaining'] as num?)?.toInt(),
      activeUntil: until,
    );
  }
}

/// Statut publié par l’abonné connecté (écran « Mes statuts »).
class MyStatus {
  const MyStatus({
    required this.id,
    required this.state,
    required this.slides,
    this.title,
    this.billing = 'NONE',
    this.paymentState = 'PENDING',
    this.offerLabel,
    this.refusalReason,
    this.expiresAt,
    this.viewCount = 0,
    required this.createdAt,
  });

  final String id;

  /// draft | awaiting_payment | pending | rejected | active | expired
  final String state;
  final List<StatusSlide> slides;
  final String? title;

  /// NONE | PASS | SINGLE
  final String billing;

  /// FREE | PENDING | PAID
  final String paymentState;
  final String? offerLabel;

  /// Refusé après paiement unique réglé : resoumission sans repayer
  bool get resubmitWithoutPayment =>
      state == 'rejected' && billing == 'SINGLE' && paymentState == 'PAID';
  final String? refusalReason;
  final DateTime? expiresAt;
  final int viewCount;
  final DateTime createdAt;

  String? get thumbUrl => slides.isEmpty ? null : slides.first.thumbUrl;
  bool get isVideo => slides.isNotEmpty && slides.first.isVideo;

  String get stateLabel => switch (state) {
    'draft' => 'Brouillon',
    'awaiting_payment' => 'Paiement en attente',
    'pending' => 'En cours de validation',
    'rejected' => 'Refusé',
    'active' => 'En ligne',
    'expired' => 'Terminé',
    _ => state,
  };

  factory MyStatus.fromJson(Map<String, dynamic> json) {
    final rawSlides = json['slides'];
    final offer = json['offer'];
    return MyStatus(
      id: '${json['id']}',
      state: '${json['state'] ?? 'draft'}',
      title: json['title'] as String?,
      slides: rawSlides is List
          ? rawSlides
                .whereType<Map>()
                .map((s) => StatusSlide.fromJson(Map<String, dynamic>.from(s)))
                .toList()
          : const [],
      billing: '${json['billing'] ?? 'NONE'}',
      paymentState: '${json['paymentState'] ?? 'PENDING'}',
      offerLabel: offer is Map ? offer['label'] as String? : null,
      refusalReason: json['refusalReason'] as String?,
      expiresAt: DateTime.tryParse('${json['expiresAt']}')?.toLocal(),
      viewCount: (json['viewCount'] as num?)?.toInt() ?? 0,
      createdAt:
          DateTime.tryParse('${json['createdAt']}')?.toLocal() ??
          DateTime.now(),
    );
  }
}

/// Formule d’abonnement : accès à toute la plateforme pendant `durationDays`.
class SubscriptionPlan {
  const SubscriptionPlan({
    required this.id,
    required this.name,
    this.description,
    required this.priceCents,
    required this.currency,
    required this.durationDays,
  });

  final String id;
  final String name;
  final String? description;
  final int priceCents;
  final String currency;
  final int durationDays;

  String get priceLabel => formatStatusPrice(priceCents, currency);

  factory SubscriptionPlan.fromJson(Map<String, dynamic> json) =>
      SubscriptionPlan(
        id: '${json['id']}',
        name: '${json['name'] ?? ''}',
        description: json['description'] as String?,
        priceCents: (json['priceCents'] as num?)?.toInt() ?? 0,
        currency: '${json['currency'] ?? 'USD'}',
        durationDays: (json['durationDays'] as num?)?.toInt() ?? 30,
      );
}
