import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api.dart';
import '../../core/models.dart';
import '../../theme/app_theme.dart';
import 'status_composer_screen.dart';
import '../payments/web_checkout.dart';

/// Statuts de l’abonné connecté.
final myStatusesProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(apiClientProvider).myStatuses(),
);

/// « Mes statuts » : suivi (validation, paiement, mise en ligne, vues),
/// paiement sur le web, correction d’un statut refusé.
class MyStatusesScreen extends ConsumerWidget {
  const MyStatusesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(myStatusesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Mes statuts')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await openStatusComposer(context);
          ref.invalidate(myStatusesProvider);
        },
        backgroundColor: AppTheme.gold,
        foregroundColor: const Color(0xFF0B0B0B),
        icon: const Icon(LucideIcons.plus),
        label: const Text('Nouveau statut'),
      ),
      body: RefreshIndicator(
        color: AppTheme.gold,
        onRefresh: () async => ref.refresh(myStatusesProvider.future),
        child: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text(
                ref.read(apiClientProvider).apiError(e),
                textAlign: TextAlign.center,
              ),
              TextButton(
                onPressed: () => ref.invalidate(myStatusesProvider),
                child: const Text('Réessayer'),
              ),
            ],
          ),
          data: (data) => ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
            children: [
              if (data.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 40),
                  child: Text(
                    'Vous n’avez pas encore publié de statut.',
                    textAlign: TextAlign.center,
                    style: AppTheme.sansText(
                      size: 15,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                )
              else
                for (final s in data) _StatusRow(status: s),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusRow extends ConsumerWidget {
  const _StatusRow({required this.status});

  final MyStatus status;

  Color _stateColor(BuildContext context) => switch (status.state) {
    'active' => const Color(0xFF16A34A),
    'pending' => const Color(0xFFD97706),
    'awaiting_payment' => const Color(0xFFD97706),
    'rejected' => Theme.of(context).colorScheme.error,
    _ => Theme.of(context).colorScheme.onSurfaceVariant,
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final thumb = status.thumbUrl;
    final caption = status.slides.isEmpty
        ? null
        : status.slides.first.caption?.trim();
    final expires = status.expiresAt;
    final details = <String>[
      if (status.state == 'active' && expires != null)
        'Visible jusqu’à ${expires.hour.toString().padLeft(2, '0')}h${expires.minute.toString().padLeft(2, '0')} le ${expires.day.toString().padLeft(2, '0')}/${expires.month.toString().padLeft(2, '0')}',
      if (status.state == 'active' || status.state == 'expired')
        '${status.viewCount} vue${status.viewCount > 1 ? 's' : ''}',
      if (status.billing == 'PASS') 'Forfait',
      if (status.billing == 'SINGLE') status.offerLabel ?? 'Publication unique',
    ];

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      color: scheme.surfaceContainerLow,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: SizedBox(
                    width: 64,
                    height: 96,
                    child: thumb != null && thumb.isNotEmpty
                        ? CachedNetworkImage(imageUrl: thumb, fit: BoxFit.cover)
                        : ColoredBox(
                            color: scheme.surfaceContainerHighest,
                            child: Icon(
                              status.isVideo
                                  ? LucideIcons.film
                                  : LucideIcons.image,
                              color: scheme.onSurfaceVariant,
                            ),
                          ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        status.stateLabel,
                        style: AppTheme.sansText(
                          size: 13,
                          weight: FontWeight.w700,
                          color: _stateColor(context),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        (caption?.isNotEmpty ?? false)
                            ? caption!
                            : (status.isVideo ? 'Vidéo' : 'Image'),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTheme.sansText(size: 14.5, height: 1.35),
                      ),
                      if (details.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          details.join(' · '),
                          style: AppTheme.sansText(
                            size: 12.5,
                            height: 1.3,
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                      if (status.state == 'rejected' &&
                          status.refusalReason != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          'Motif : ${status.refusalReason}',
                          style: AppTheme.sansText(
                            size: 13,
                            height: 1.35,
                            color: scheme.error,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            _Actions(status: status),
          ],
        ),
      ),
    );
  }
}

class _Actions extends ConsumerWidget {
  const _Actions({required this.status});

  final MyStatus status;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final buttons = <Widget>[
      if (status.state == 'awaiting_payment')
        TextButton.icon(
          onPressed: () => _pay(context, ref),
          icon: const Icon(LucideIcons.globe, size: 16),
          label: const Text('Payer'),
        ),
      if (status.state == 'rejected' || status.state == 'draft')
        TextButton.icon(
          onPressed: () async {
            await openStatusComposer(context, edit: status);
            ref.invalidate(myStatusesProvider);
          },
          icon: const Icon(LucideIcons.pencil, size: 16),
          label: Text(status.state == 'draft' ? 'Terminer' : 'Corriger'),
        ),
      TextButton.icon(
        onPressed: () => _confirmDelete(context, ref),
        icon: const Icon(LucideIcons.trash2, size: 16),
        label: const Text('Supprimer'),
        style: TextButton.styleFrom(
          foregroundColor: Theme.of(context).colorScheme.error,
        ),
      ),
    ];
    return Align(
      alignment: Alignment.centerRight,
      child: Wrap(spacing: 4, children: buttons),
    );
  }

  /// Paiement du statut sur la page web /paiement.
  Future<void> _pay(BuildContext context, WidgetRef ref) async {
    final api = ref.read(apiClientProvider);
    try {
      await payOnWeb(context, ref, kind: 'STATUS', statusId: status.id);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(api.apiError(e))));
      }
    }
    ref.invalidate(myStatusesProvider);
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final paidPending =
        status.billing == 'SINGLE' &&
        (status.state == 'pending' || status.state == 'rejected');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer ce statut ?'),
        content: Text(
          paidPending
              ? 'Le statut et son média seront supprimés. La publication déjà '
                    'payée ne sera pas remboursée automatiquement.'
              : 'Le statut et son média seront supprimés définitivement.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    final api = ref.read(apiClientProvider);
    try {
      await api.deleteMyStatus(status.id);
      ref.invalidate(myStatusesProvider);
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(api.apiError(e))));
    }
  }
}
