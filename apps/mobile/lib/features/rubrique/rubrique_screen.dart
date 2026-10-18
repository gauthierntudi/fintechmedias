import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants.dart';
import '../news/category_feed.dart';
import '../shorts/shorts_feed.dart';

class RubriqueScreen extends ConsumerWidget {
  const RubriqueScreen({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (isShortRubrique(slug)) {
      return const ShortsScreen();
    }
    final feed = ref.watch(categoryFeedProvider(slug));
    return Scaffold(
      appBar: AppBar(
        title: Text(
          capitalizeLabel(
            feed.label.isNotEmpty ? feed.label : slug,
          ),
        ),
      ),
      body: CategoryFeedView(
        slug: slug,
        showExcerpt: showRubriqueExcerpt(slug),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        emptyMessage: 'Pas encore d’articles.',
      ),
    );
  }
}
