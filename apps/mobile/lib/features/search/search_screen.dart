import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/api.dart';
import '../../core/article_nav.dart';
import '../../core/constants.dart';
import '../../core/models.dart';
import '../../theme/app_theme.dart';
import '../../widgets/article_tile.dart';
import '../../widgets/cover.dart';
import '../../widgets/skeleton.dart';

const _kSearchTake = 12;
const _kDebounce = Duration(milliseconds: 280);

class _CategoryStatus {
  const _CategoryStatus({
    required this.slug,
    required this.label,
    required this.tone,
    required this.article,
  });

  final String slug;
  final String label;
  final String tone;
  final ArticleCard article;
}

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _controller = TextEditingController();
  List<_CategoryStatus> _statuses = const [];
  List<ArticleCard> _suggestions = const [];
  List<ArticleCard> _results = const [];
  bool _loading = true;
  String? _error;
  Timer? _debounce;
  int _reqId = 0;

  bool get _isSearch => _controller.text.trim().length >= 2;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onQueryChanged);
    _loadSuggestions();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller
      ..removeListener(_onQueryChanged)
      ..dispose();
    super.dispose();
  }

  void _onQueryChanged() {
    setState(() {});
    _debounce?.cancel();
    final q = _controller.text.trim();
    if (q.length < 2) {
      _reqId++;
      if (_suggestions.isEmpty && _statuses.isEmpty) {
        _loadSuggestions();
      } else {
        setState(() {
          _loading = false;
          _error = null;
          _results = const [];
        });
      }
      return;
    }
    _debounce = Timer(_kDebounce, () => _runSearch(q));
  }

  Future<void> _loadSuggestions() async {
    final id = ++_reqId;
    setState(() {
      _loading = true;
      _error = null;
    });
    final api = ref.read(apiClientProvider);
    try {
      final recommendedFuture = api.randomArticles(take: _kSearchTake);
      final statusFutures = kRubriques.map((r) async {
        try {
          final feed = await api.byCategory(r.slug, take: 1);
          final article = feed.items.firstOrNull;
          if (article == null) return null;
          return _CategoryStatus(
            slug: r.slug,
            label: feed.label.isNotEmpty ? feed.label : r.label,
            tone: r.tone,
            article: article,
          );
        } catch (_) {
          return null;
        }
      });

      final recommended = await recommendedFuture;
      final statuses = (await Future.wait(statusFutures)).whereType<_CategoryStatus>().toList();

      if (!mounted || id != _reqId) return;
      setState(() {
        _suggestions = recommended;
        _statuses = statuses;
        _loading = false;
      });
    } catch (e) {
      if (!mounted || id != _reqId) return;
      setState(() {
        _error = api.apiError(e);
        _loading = false;
      });
    }
  }

  Future<void> _runSearch(String q) async {
    final id = ++_reqId;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ref.read(apiClientProvider).search(
            q,
            take: _kSearchTake,
          );
      if (!mounted || id != _reqId) return;
      setState(() {
        _results = res.items;
        _loading = false;
      });
    } catch (e) {
      if (!mounted || id != _reqId) return;
      setState(() {
        _error = ref.read(apiClientProvider).apiError(e);
        _loading = false;
      });
    }
  }

  void _clear() => _controller.clear();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final hasQuery = _controller.text.isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _controller,
          autofocus: true,
          textInputAction: TextInputAction.search,
          decoration: const InputDecoration(
            hintText: 'Rechercher un article…',
            border: InputBorder.none,
          ),
          onSubmitted: (v) {
            final q = v.trim();
            if (q.length >= 2) _runSearch(q);
          },
        ),
        actions: [
          if (hasQuery)
            IconButton(
              tooltip: 'Effacer',
              onPressed: _clear,
              icon: const Icon(LucideIcons.x),
            )
          else
            IconButton(
              tooltip: 'Rechercher',
              onPressed: () {
                final q = _controller.text.trim();
                if (q.length >= 2) {
                  _runSearch(q);
                } else {
                  _loadSuggestions();
                }
              },
              icon: const Icon(LucideIcons.search),
            ),
        ],
      ),
      body: _isSearch ? _buildResults(scheme) : _buildSuggestions(scheme),
    );
  }

  Widget _buildResults(ColorScheme scheme) {
    if (_loading && _results.isEmpty) {
      return const ArticleListSkeleton();
    }
    if (_error != null && _results.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            _error!,
            textAlign: TextAlign.center,
            style: AppTheme.sansText(
              color: scheme.onSurface.withValues(alpha: 0.7),
            ),
          ),
        ),
      );
    }
    if (_results.isEmpty) {
      return Center(
        child: Text(
          'Aucun article trouvé',
          style: AppTheme.sansText(
            color: scheme.onSurface.withValues(alpha: 0.6),
          ),
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      itemCount: _results.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, i) => ArticleTile(article: _results[i]),
    );
  }

  Widget _buildSuggestions(ColorScheme scheme) {
    if (_loading && _suggestions.isEmpty && _statuses.isEmpty) {
      return const _SuggestionsSkeleton();
    }
    if (_error != null && _suggestions.isEmpty && _statuses.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            _error!,
            textAlign: TextAlign.center,
            style: AppTheme.sansText(
              color: scheme.onSurface.withValues(alpha: 0.7),
            ),
          ),
        ),
      );
    }
    if (_suggestions.isEmpty && _statuses.isEmpty) {
      return Center(
        child: Text(
          'Aucune suggestion',
          style: AppTheme.sansText(
            color: scheme.onSurface.withValues(alpha: 0.6),
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.only(bottom: 40),
      children: [
        if (_statuses.isNotEmpty) ...[
          const SizedBox(height: 8),
          SizedBox(
            height: 168,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _statuses.length,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (context, i) => _CategoryStatusCard(
                status: _statuses[i],
              ),
            ),
          ),
          const SizedBox(height: 22),
        ],
        if (_suggestions.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              'Recommandés',
              style: AppTheme.displayText(
                size: 26,
                weight: FontWeight.w800,
                letterSpacing: -0.4,
                color: scheme.onSurface,
              ),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 280,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: _suggestions.length,
              separatorBuilder: (_, _) => const SizedBox(width: 14),
              itemBuilder: (context, i) => _RecommendedCard(
                article: _suggestions[i],
                playlist: _suggestions,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Statut type Stories : carte portrait, cover plein cadre, avatar + rubrique.
class _CategoryStatusCard extends StatelessWidget {
  const _CategoryStatusCard({required this.status});

  final _CategoryStatus status;

  @override
  Widget build(BuildContext context) {
    final tone = AppTheme.toneColor(status.tone);
    final article = status.article;
    final cover = article.hasReadyVideo
        ? (article.videoPosterUrl ?? article.coverUrl)
        : article.coverUrl;
    final avatar = article.authorAvatarUrl;
    final initials = _initials(article.authorName);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => openArticleCard(context, article),
        child: Ink(
          width: 100,
          height: 168,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: tone.withValues(alpha: 0.35),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (cover != null && cover.isNotEmpty)
                  CachedNetworkImage(
                    imageUrl: cover,
                    fit: BoxFit.cover,
                    placeholder: (_, _) =>
                        ColoredBox(color: tone.withValues(alpha: 0.4)),
                    errorWidget: (_, _, _) =>
                        ColoredBox(color: tone.withValues(alpha: 0.5)),
                  )
                else
                  ColoredBox(color: tone.withValues(alpha: 0.55)),
                // Dégradé bas pour lisibilité du label
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Color(0x00000000),
                        Color(0x00000000),
                        Color(0x99000000),
                      ],
                      stops: [0.0, 0.45, 1.0],
                    ),
                  ),
                ),
                // Avatar auteur (haut gauche) + anneau couleur rubrique
                Positioned(
                  top: 10,
                  left: 10,
                  child: Container(
                    width: 36,
                    height: 36,
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: tone, width: 2.5),
                      color: Colors.white,
                    ),
                    child: ClipOval(
                      child: avatar == null || avatar.isEmpty
                          ? ColoredBox(
                              color: tone.withValues(alpha: 0.2),
                              child: Center(
                                child: Text(
                                  initials,
                                  style: AppTheme.sansText(
                                    size: 12,
                                    weight: FontWeight.w800,
                                    color: tone.computeLuminance() > 0.55
                                        ? AppTheme.navy
                                        : tone,
                                  ),
                                ),
                              ),
                            )
                          : CachedNetworkImage(
                              imageUrl: avatar,
                              fit: BoxFit.cover,
                              placeholder: (_, _) => ColoredBox(
                                color: tone.withValues(alpha: 0.2),
                              ),
                              errorWidget: (_, _, _) => ColoredBox(
                                color: tone.withValues(alpha: 0.2),
                                child: Center(
                                  child: Text(
                                    initials,
                                    style: AppTheme.sansText(
                                      size: 12,
                                      weight: FontWeight.w800,
                                      color: tone,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                    ),
                  ),
                ),
                // Nom de rubrique
                Positioned(
                  left: 10,
                  right: 10,
                  bottom: 10,
                  child: Text(
                    status.label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTheme.sansText(
                      size: 13,
                      weight: FontWeight.w800,
                      height: 1.15,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static String _initials(String name) {
    final parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .toList();
    if (parts.isEmpty) return 'F';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
}

class _RecommendedCard extends StatelessWidget {
  const _RecommendedCard({required this.article, required this.playlist});

  final ArticleCard article;
  final List<ArticleCard> playlist;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final video = article.hasReadyVideo;
    final cover = video
        ? (article.videoPosterUrl ?? article.coverUrl)
        : article.coverUrl;
    final metaParts = <String>[
      if (article.categoryLabel.trim().isNotEmpty)
        capitalizeLabel(article.categoryLabel),
      if (article.dateLabel.trim().isNotEmpty) article.dateLabel.trim(),
      if (video && article.durationLabel.isNotEmpty) article.durationLabel,
    ];

    return SizedBox(
      width: 168,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: () => openArticleCard(context, article, playlist: playlist),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AspectRatio(
                aspectRatio: 3 / 4,
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    return Stack(
                      fit: StackFit.expand,
                      children: [
                        Cover(
                          url: cover,
                          height: constraints.maxHeight,
                          radius: 22,
                          play: false,
                        ),
                        if (video)
                          Positioned(
                            right: 10,
                            bottom: 10,
                            child: Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: AppTheme.navy.withValues(alpha: 0.92),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(
                                LucideIcons.play,
                                size: 16,
                                color: Color(0xFF4ED319),
                              ),
                            ),
                          ),
                      ],
                    );
                  },
                ),
              ),
              const SizedBox(height: 10),
              Text(
                article.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTheme.displayText(
                  size: 16,
                  weight: FontWeight.w800,
                  height: 1.2,
                  letterSpacing: -0.2,
                  color: scheme.onSurface,
                ),
              ),
              if (metaParts.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  metaParts.join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTheme.sansText(
                    size: 12,
                    weight: FontWeight.w500,
                    color: scheme.onSurface.withValues(alpha: 0.5),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _SuggestionsSkeleton extends StatelessWidget {
  const _SuggestionsSkeleton();

  @override
  Widget build(BuildContext context) {
    return Skeleton(
      child: ListView(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 40),
        children: [
          const SizedBox(height: 8),
          SizedBox(
            height: 168,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: 5,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (_, _) => const SkeletonBone(
                width: 100,
                height: 168,
                radius: 16,
              ),
            ),
          ),
          const SizedBox(height: 22),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: SkeletonBone(width: 160, height: 28, radius: 4),
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 280,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: 3,
              separatorBuilder: (_, _) => const SizedBox(width: 14),
              itemBuilder: (_, _) => const SizedBox(
                width: 168,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AspectRatio(
                      aspectRatio: 3 / 4,
                      child: SkeletonBone(
                        height: double.infinity,
                        radius: 22,
                      ),
                    ),
                    SizedBox(height: 10),
                    SkeletonBone(height: 16, radius: 2),
                    SizedBox(height: 6),
                    SkeletonBone(width: 100, height: 12, radius: 2),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
