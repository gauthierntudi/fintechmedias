import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import 'constants.dart';
import 'models.dart';

final _toneBySlug = <String, String>{};

void rememberArticleTone(String slug, String? tone) {
  final key = tone?.trim();
  if (key == null || key.isEmpty) return;
  _toneBySlug[slug] = key;
}

String? rememberedArticleTone(String slug) => _toneBySlug[slug];

String articleToneOf(ArticleCard article) {
  final tone = article.categoryTone.trim();
  if (tone.isNotEmpty) return tone;
  return toneFromCategory(article.category, article.categoryLabel);
}

/// Entrée de la file de lecture (swipe article → article).
class ReadingQueueItem {
  const ReadingQueueItem({
    required this.slug,
    this.tone,
    this.category,
    this.categoryLabel,
  });

  final String slug;
  final String? tone;
  final String? category;
  final String? categoryLabel;

  factory ReadingQueueItem.fromCard(ArticleCard article) {
    return ReadingQueueItem(
      slug: article.slug,
      tone: articleToneOf(article),
      category: article.category,
      categoryLabel: article.categoryLabel,
    );
  }
}

class ReadingQueue {
  ReadingQueue({required this.items, required this.index});

  final List<ReadingQueueItem> items;
  int index;
}

ReadingQueue? _readingQueue;

/// Articles swipeables (hors rubrique Short).
List<ArticleCard> readingPlaylistOf(Iterable<ArticleCard> articles) {
  final seen = <String>{};
  final out = <ArticleCard>[];
  for (final a in articles) {
    if (isShortRubrique(a.category, a.categoryLabel)) continue;
    if (!seen.add(a.slug)) continue;
    out.add(a);
  }
  return out;
}

void setReadingQueue(
  List<ArticleCard> playlist, {
  required String currentSlug,
  String? currentTone,
  String? currentCategory,
  String? currentCategoryLabel,
}) {
  final items = readingPlaylistOf(playlist)
      .map(ReadingQueueItem.fromCard)
      .toList();
  var index = items.indexWhere((e) => e.slug == currentSlug);
  if (index < 0) {
    items.insert(
      0,
      ReadingQueueItem(
        slug: currentSlug,
        tone: currentTone,
        category: currentCategory,
        categoryLabel: currentCategoryLabel,
      ),
    );
    index = 0;
  }
  _readingQueue = ReadingQueue(items: items, index: index);
}

void setReadingQueueIndex(int index) {
  final q = _readingQueue;
  if (q == null || index < 0 || index >= q.items.length) return;
  q.index = index;
}

/// File pour [slug], ou file à un seul article.
ReadingQueue readingQueueFor(String slug, {String? fallbackTone}) {
  final q = _readingQueue;
  if (q != null) {
    final i = q.items.indexWhere((e) => e.slug == slug);
    if (i >= 0) {
      q.index = i;
      return q;
    }
  }
  final single = ReadingQueue(
    items: [
      ReadingQueueItem(
        slug: slug,
        tone: fallbackTone ?? rememberedArticleTone(slug),
      ),
    ],
    index: 0,
  );
  _readingQueue = single;
  return single;
}

void openArticle(
  BuildContext context, {
  required String slug,
  String? tone,
  String? category,
  String? categoryLabel,
  bool replace = false,
  List<ArticleCard>? playlist,
}) {
  if (isShortRubrique(category, categoryLabel)) {
    final path = '/shorts/${Uri.encodeComponent(slug)}';
    if (replace) {
      context.pushReplacement(path);
    } else {
      context.push(path);
    }
    return;
  }
  final resolved = (tone != null && tone.trim().isNotEmpty)
      ? tone.trim()
      : toneFromCategory(category, categoryLabel);
  rememberArticleTone(slug, resolved);

  if (playlist != null) {
    setReadingQueue(
      playlist,
      currentSlug: slug,
      currentTone: resolved,
      currentCategory: category,
      currentCategoryLabel: categoryLabel,
    );
  } else {
    final q = _readingQueue;
    final inQueue = q != null && q.items.any((e) => e.slug == slug);
    if (!inQueue) {
      setReadingQueue(
        const [],
        currentSlug: slug,
        currentTone: resolved,
        currentCategory: category,
        currentCategoryLabel: categoryLabel,
      );
    } else {
      setReadingQueueIndex(q.items.indexWhere((e) => e.slug == slug));
    }
  }

  final path = '/article/${Uri.encodeComponent(slug)}';
  if (replace) {
    context.pushReplacement(path, extra: resolved);
  } else {
    context.push(path, extra: resolved);
  }
}

void openArticleCard(
  BuildContext context,
  ArticleCard article, {
  bool replace = false,
  List<ArticleCard>? playlist,
}) {
  openArticle(
    context,
    slug: article.slug,
    tone: articleToneOf(article),
    category: article.category,
    categoryLabel: article.categoryLabel,
    replace: replace,
    playlist: playlist,
  );
}
