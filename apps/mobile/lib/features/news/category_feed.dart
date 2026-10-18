import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api.dart';
import '../../core/models.dart';
import '../../theme/app_theme.dart';
import '../../widgets/article_tile.dart';

const kCategoryPageSize = 12;

class CategoryFeedState {
  const CategoryFeedState({
    this.items = const [],
    this.label = '',
    this.tone = 'teal',
    this.category = '',
    this.total = 0,
    this.loading = true,
    this.loadingMore = false,
    this.error,
  });

  final List<ArticleCard> items;
  final String label;
  final String tone;
  final String category;
  final int total;
  final bool loading;
  final bool loadingMore;
  final Object? error;

  bool get hasMore {
    if (total > 0) return items.length < total;
    // Fallback si l’API ne renvoie pas total : continuer tant que la page est pleine.
    return items.isNotEmpty && items.length % kCategoryPageSize == 0;
  }

  CategoryFeedState copyWith({
    List<ArticleCard>? items,
    String? label,
    String? tone,
    String? category,
    int? total,
    bool? loading,
    bool? loadingMore,
    Object? error,
    bool clearError = false,
  }) {
    return CategoryFeedState(
      items: items ?? this.items,
      label: label ?? this.label,
      tone: tone ?? this.tone,
      category: category ?? this.category,
      total: total ?? this.total,
      loading: loading ?? this.loading,
      loadingMore: loadingMore ?? this.loadingMore,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class CategoryFeedController extends StateNotifier<CategoryFeedState> {
  CategoryFeedController(this._api, this.slug) : super(const CategoryFeedState()) {
    refresh();
  }

  final ApiClient _api;
  final String slug;
  bool _loadMoreLocked = false;

  Future<CategoryFeed> _fetch({required int skip}) {
    if (slug.isEmpty) {
      return _api.feed(take: kCategoryPageSize, skip: skip);
    }
    return _api.byCategory(slug, take: kCategoryPageSize, skip: skip);
  }

  Future<void> refresh() async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final feed = await _fetch(skip: 0);
      if (!mounted) return;
      state = CategoryFeedState(
        items: _unique(feed.items),
        label: feed.label,
        tone: feed.tone,
        category: feed.category,
        total: feed.total,
        loading: false,
      );
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(loading: false, error: e);
    }
  }

  Future<void> loadMore() async {
    if (_loadMoreLocked || state.loading || state.loadingMore || !state.hasMore) {
      return;
    }
    _loadMoreLocked = true;
    state = state.copyWith(loadingMore: true, clearError: true);
    try {
      final feed = await _fetch(skip: state.items.length);
      if (!mounted) return;
      final merged = _unique([...state.items, ...feed.items]);
      final total = feed.total > 0 ? feed.total : state.total;
      state = state.copyWith(
        items: merged,
        label: feed.label.isNotEmpty ? feed.label : state.label,
        tone: feed.tone.isNotEmpty ? feed.tone : state.tone,
        category: feed.category.isNotEmpty ? feed.category : state.category,
        total: total,
        loadingMore: false,
      );
      // Si la page est vide, on stoppe définitivement.
      if (feed.items.isEmpty) {
        state = state.copyWith(total: merged.length);
      }
    } catch (_) {
      if (!mounted) return;
      state = state.copyWith(loadingMore: false);
    } finally {
      _loadMoreLocked = false;
    }
  }
}

List<ArticleCard> _unique(Iterable<ArticleCard> items) {
  final seen = <String>{};
  return [
    for (final a in items)
      if (seen.add(a.id)) a,
  ];
}

final categoryFeedProvider = StateNotifierProvider.family<
    CategoryFeedController, CategoryFeedState, String>((ref, slug) {
  return CategoryFeedController(ref.watch(apiClientProvider), slug);
});

bool showRubriqueExcerpt(String slug) {
  return slug == 'actualites' ||
      slug == 'interview' ||
      slug == 'economie' ||
      slug == 'politique' ||
      slug == 'entreprise' ||
      slug == 'portrait' ||
      slug == 'events' ||
      slug == 'international' ||
      slug.isEmpty;
}

/// Liste paginée d’une rubrique (ou fil « Tous » si [slug] est vide).
class CategoryFeedView extends ConsumerStatefulWidget {
  const CategoryFeedView({
    super.key,
    required this.slug,
    this.showMeta = false,
    this.showExcerpt = true,
    this.padding = const EdgeInsets.fromLTRB(20, 16, 20, 40),
    this.emptyMessage = 'Pas encore d’articles ici.',
  });

  final String slug;
  final bool showMeta;
  final bool showExcerpt;
  final EdgeInsets padding;
  final String emptyMessage;

  @override
  ConsumerState<CategoryFeedView> createState() => _CategoryFeedViewState();
}

class _CategoryFeedViewState extends ConsumerState<CategoryFeedView> {
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scroll
      ..removeListener(_onScroll)
      ..dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;
    final pos = _scroll.position;
    if (pos.pixels >= pos.maxScrollExtent - 480) {
      ref.read(categoryFeedProvider(widget.slug).notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(categoryFeedProvider(widget.slug));
    final scheme = Theme.of(context).colorScheme;

    if (state.loading && state.items.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (state.error != null && state.items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                ref.read(apiClientProvider).apiError(state.error!),
                textAlign: TextAlign.center,
                style: AppTheme.sansText(
                  size: 15,
                  height: 1.45,
                  color: scheme.onSurface.withValues(alpha: 0.7),
                ),
              ),
              const SizedBox(height: 14),
              FilledButton(
                onPressed: () =>
                    ref.read(categoryFeedProvider(widget.slug).notifier).refresh(),
                child: const Text('Réessayer'),
              ),
            ],
          ),
        ),
      );
    }

    if (state.items.isEmpty) {
      return Center(
        child: Text(
          widget.emptyMessage,
          style: AppTheme.sansText(
            color: scheme.onSurface.withValues(alpha: 0.6),
          ),
        ),
      );
    }

    final footer = state.loadingMore ? 1 : 0;

    return RefreshIndicator(
      color: AppTheme.gold,
      onRefresh: () =>
          ref.read(categoryFeedProvider(widget.slug).notifier).refresh(),
      child: ListView.builder(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: widget.padding,
        itemCount: state.items.length + footer,
        itemBuilder: (context, i) {
          if (i >= state.items.length) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Center(
                child: SizedBox(
                  width: 28,
                  height: 28,
                  child: CircularProgressIndicator(strokeWidth: 2.4),
                ),
              ),
            );
          }
          final article = state.items[i];
          final playlist = state.items;
          if (i == 0) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: FeaturedCard(
                article: article,
                showExcerpt: widget.showExcerpt,
                playlist: playlist,
              ),
            );
          }
          return ArticleTile(
            article: article,
            showMeta: widget.showMeta,
            showExcerpt: widget.showExcerpt,
            playlist: playlist,
          );
        },
      ),
    );
  }
}
