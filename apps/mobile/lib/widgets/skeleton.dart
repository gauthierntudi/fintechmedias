import 'package:flutter/material.dart';

/// Shimmer partagé (~1.1s, comme le web) pour les états de chargement.
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, required this.child, this.onColor = false});

  final Widget child;

  /// Os clairs sur fond teinté (ex. article / kiosque).
  final bool onColor;

  static SkeletonState? maybeOf(BuildContext context) =>
      context.findAncestorStateOfType<SkeletonState>();

  @override
  State<Skeleton> createState() => SkeletonState();
}

class SkeletonState extends State<Skeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController controller;

  @override
  void initState() {
    super.initState();
    controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat();
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// Bloc / ligne animé.
class SkeletonBone extends StatelessWidget {
  const SkeletonBone({
    super.key,
    this.width,
    this.height = 16,
    this.radius = 0,
  });

  final double? width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final state = Skeleton.maybeOf(context);
    final onColor = state?.widget.onColor ?? false;
    final base = Theme.of(context).colorScheme.surfaceContainerHighest;
    final low = onColor
        ? Colors.white.withValues(alpha: 0.28)
        : Color.lerp(base, Colors.black, 0.04)!;
    final high = onColor
        ? Colors.white.withValues(alpha: 0.5)
        : Color.lerp(base, Colors.white, 0.35)!;

    Widget bone(double t) {
      return Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(radius),
          gradient: LinearGradient(
            begin: Alignment(-1.0 + 2.0 * t, 0),
            end: Alignment(1.0 + 2.0 * t, 0),
            colors: [low, high, low],
            stops: const [0.25, 0.5, 0.75],
          ),
        ),
      );
    }

    if (state == null) return bone(0.5);

    return AnimatedBuilder(
      animation: state.controller,
      builder: (_, _) => bone(state.controller.value),
    );
  }
}

/// Accueil « À la une » : featured + grille 2×2 + rail.
class HomeFeedSkeleton extends StatelessWidget {
  const HomeFeedSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Skeleton(
      child: ListView(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
        children: [
          const AspectRatio(
            aspectRatio: 4 / 3,
            child: SkeletonBone(height: double.infinity),
          ),
          const SizedBox(height: 14),
          const SkeletonBone(width: 120, height: 12),
          const SizedBox(height: 8),
          const SkeletonBone(height: 22, radius: 2),
          const SizedBox(height: 6),
          const SkeletonBone(width: 220, height: 22, radius: 2),
          const SizedBox(height: 20),
          LayoutBuilder(
            builder: (context, constraints) {
              final gap = 12.0;
              final w = (constraints.maxWidth - gap) / 2;
              final h = w * 3 / 4;
              return Wrap(
                spacing: gap,
                runSpacing: 16,
                children: [
                  for (var i = 0; i < 4; i++)
                    SizedBox(
                      width: w,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SkeletonBone(height: h),
                          const SizedBox(height: 8),
                          const SkeletonBone(height: 12, radius: 2),
                          const SizedBox(height: 6),
                          const SkeletonBone(
                            width: 90,
                            height: 12,
                            radius: 2,
                          ),
                        ],
                      ),
                    ),
                ],
              );
            },
          ),
          const SizedBox(height: 28),
          const SkeletonBone(width: 140, height: 16, radius: 2),
          const SizedBox(height: 14),
          SizedBox(
            height: 160,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: 3,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (_, _) => const SizedBox(
                width: 140,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: SkeletonBone(height: double.infinity)),
                    SizedBox(height: 8),
                    SkeletonBone(height: 12, radius: 2),
                    SizedBox(height: 6),
                    SkeletonBone(width: 80, height: 10, radius: 2),
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

/// Fil rubrique / actualités : featured + tuiles.
class CategoryFeedSkeleton extends StatelessWidget {
  const CategoryFeedSkeleton({super.key, this.padding});

  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return Skeleton(
      child: ListView(
        physics: const NeverScrollableScrollPhysics(),
        padding: padding ?? const EdgeInsets.fromLTRB(20, 16, 20, 40),
        children: [
          const AspectRatio(
            aspectRatio: 4 / 3,
            child: SkeletonBone(height: double.infinity),
          ),
          const SizedBox(height: 14),
          const SkeletonBone(height: 20, radius: 2),
          const SizedBox(height: 6),
          const SkeletonBone(width: 200, height: 20, radius: 2),
          const SizedBox(height: 20),
          for (var i = 0; i < 5; i++) ...[
            if (i > 0) const SizedBox(height: 4),
            const _TileBone(),
          ],
        ],
      ),
    );
  }
}

class _TileBone extends StatelessWidget {
  const _TileBone();

  @override
  Widget build(BuildContext context) {
    const thumbH = 88.0;
    final thumbW = thumbH * 4 / 3;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: thumbW,
            height: thumbH,
            child: const SkeletonBone(height: thumbH),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBone(width: 72, height: 10, radius: 2),
                SizedBox(height: 8),
                SkeletonBone(height: 16, radius: 2),
                SizedBox(height: 6),
                SkeletonBone(height: 16, radius: 2),
                SizedBox(height: 6),
                SkeletonBone(width: 120, height: 16, radius: 2),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Liste simple (recherche, etc.).
class ArticleListSkeleton extends StatelessWidget {
  const ArticleListSkeleton({
    super.key,
    this.count = 8,
    this.padding = const EdgeInsets.fromLTRB(16, 8, 16, 32),
  });

  final int count;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Skeleton(
      child: ListView.builder(
        physics: const NeverScrollableScrollPhysics(),
        padding: padding,
        itemCount: count,
        itemBuilder: (_, _) => const _TileBone(),
      ),
    );
  }
}

/// Écran article : cover + titres + corps.
class ArticleDetailSkeleton extends StatelessWidget {
  const ArticleDetailSkeleton({super.key, this.onColor = false});

  final bool onColor;

  @override
  Widget build(BuildContext context) {
    return Skeleton(
      onColor: onColor,
      child: CustomScrollView(
        physics: const NeverScrollableScrollPhysics(),
        slivers: [
          const SliverToBoxAdapter(
            child: AspectRatio(
              aspectRatio: 16 / 10,
              child: SkeletonBone(height: double.infinity),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                const SkeletonBone(width: 96, height: 12, radius: 2),
                const SizedBox(height: 16),
                const SkeletonBone(height: 28, radius: 2),
                const SizedBox(height: 8),
                const SkeletonBone(height: 28, radius: 2),
                const SizedBox(height: 8),
                const SkeletonBone(width: 240, height: 28, radius: 2),
                const SizedBox(height: 20),
                const SkeletonBone(height: 14, radius: 2),
                const SizedBox(height: 8),
                const SkeletonBone(height: 14, radius: 2),
                const SizedBox(height: 8),
                const SkeletonBone(width: 180, height: 14, radius: 2),
                const SizedBox(height: 28),
                for (var i = 0; i < 8; i++) ...[
                  const SkeletonBone(height: 14, radius: 2),
                  const SizedBox(height: 10),
                ],
                const SkeletonBone(width: 160, height: 14, radius: 2),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

/// Bloc « à lire aussi » sous un article.
class RelatedSkeleton extends StatelessWidget {
  const RelatedSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const Skeleton(
      child: Padding(
        padding: EdgeInsets.only(top: 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SkeletonBone(width: 140, height: 16, radius: 2),
            SizedBox(height: 12),
            _TileBone(),
            _TileBone(),
          ],
        ),
      ),
    );
  }
}

/// Kiosque : hero + grille.
class KiosqueSkeleton extends StatelessWidget {
  const KiosqueSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Skeleton(
      onColor: true,
      child: Column(
        children: [
          const Expanded(
            child: Padding(
              padding: EdgeInsets.fromLTRB(40, 80, 40, 40),
              child: SkeletonBone(height: double.infinity, radius: 0),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 40),
            child: Row(
              children: [
                for (var i = 0; i < 2; i++) ...[
                  if (i > 0) const SizedBox(width: 14),
                  const Expanded(
                    child: AspectRatio(
                      aspectRatio: 0.62,
                      child: SkeletonBone(height: double.infinity),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
