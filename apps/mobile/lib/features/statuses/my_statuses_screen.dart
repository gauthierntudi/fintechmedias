import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api.dart';
import '../../core/models.dart';
import '../../theme/app_theme.dart';
import 'status_composer_screen.dart';
import 'status_payment.dart';

/// Statuts de l’abonné connecté + forfaits.
final myStatusesProvider = FutureProvider.autoDispose((ref) async {
  final api = ref.watch(apiClientProvider);
  final results = await Future.wait([
    api.myStatuses(),
    api.myStatusPasses(),
  ]);
  return (
    items: results[0] as List<MyStatus>,
    passes: results[1] as StatusPasses,
  );
});

/// « Mes statuts » : suivi (validation, paiement, mise en ligne, vues),
/// relance d’un paiement, correction d’un statut refusé, forfait.
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
              _PassCard(passes: data.passes),
              const SizedBox(height: 16),
              if (data.items.isEmpty)
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
                for (final s in data.items) _StatusRow(status: s),
            ],
          ),
        ),
      ),
    );
  }
}

/// Forfait actif, ou proposition d’achat.
class _PassCard extends ConsumerWidget {
  const _PassCard({required this.passes});

  final StatusPasses passes;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final until = passes.activeUntil;
    final active = passes.hasActivePass;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Icon(LucideIcons.layers, color: AppTheme.gold),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  active ? 'Forfait Statuts actif' : 'Aucun forfait actif',
                  style: AppTheme.sansText(size: 15, weight: FontWeight.w700),
                ),
                Text(
                  active
                      ? [
                          passes.remaining == null
                              ? 'Publications illimitées'
                              : '${passes.remaining} publication(s) restante(s)',
                          if (until != null)
                            'jusqu’au ${until.day.toString().padLeft(2, '0')}/${until.month.toString().padLeft(2, '0')}/${until.year}',
                        ].join(' · ')
                      : 'Publiez plusieurs statuts à prix réduit.',
                  style: AppTheme.sansText(
                    size: 13,
                    height: 1.35,
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          if (!active)
            TextButton(
              onPressed: () async {
                await showBuyPassSheet(context);
                ref.invalidate(myStatusesProvider);
              },
              child: const Text('Voir'),
            ),
        ],
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
          onPressed: () async {
            await showPayStatusSheet(context, status.id);
            ref.invalidate(myStatusesProvider);
          },
          icon: const Icon(LucideIcons.smartphone, size: 16),
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

// ---------------------------------------------------------- paiements

/// Relance le paiement Mobile Money d’un statut « publication unique ».
Future<void> showPayStatusSheet(BuildContext context, String statusId) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    useSafeArea: true,
    builder: (_) => _PaySheet(
      title: 'Payer la publication',
      intro: 'Votre statut sera envoyé à la rédaction dès réception du paiement.',
      run: (api, phone) => api.payMyStatus(statusId, phone),
    ),
  );
}

/// Achat d’un forfait « Statuts » (liste des forfaits proposés).
Future<void> showBuyPassSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    useSafeArea: true,
    builder: (_) => const _BuyPassSheet(),
  );
}

class _BuyPassSheet extends ConsumerStatefulWidget {
  const _BuyPassSheet();

  @override
  ConsumerState<_BuyPassSheet> createState() => _BuyPassSheetState();
}

class _BuyPassSheetState extends ConsumerState<_BuyPassSheet> {
  late final Future<List<StatusOffer>> _offers = ref
      .read(apiClientProvider)
      .statusOffers()
      .then((all) => all.where((o) => o.isPass).toList());
  StatusOffer? _picked;

  @override
  Widget build(BuildContext context) {
    final picked = _picked;
    if (picked != null) {
      return _PaySheet(
        title: picked.label,
        intro: '${picked.detail} — ${picked.priceLabel}',
        run: (api, phone) => api.checkoutStatusPass(picked.id, phone),
      );
    }
    return FutureBuilder<List<StatusOffer>>(
      future: _offers,
      builder: (context, snap) {
        final offers = snap.data ?? const <StatusOffer>[];
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Forfaits Statuts', style: AppTheme.displayText(size: 22)),
              const SizedBox(height: 12),
              if (snap.connectionState != ConnectionState.done)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (offers.isEmpty)
                const Text('Aucun forfait proposé pour le moment.')
              else
                for (final o in offers)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(LucideIcons.layers, color: AppTheme.gold),
                    title: Text(o.label),
                    subtitle: Text(o.description ?? o.detail),
                    trailing: Text(
                      o.priceLabel,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    onTap: () => setState(() => _picked = o),
                  ),
            ],
          ),
        );
      },
    );
  }
}

/// Saisie du numéro + paiement + attente de confirmation.
class _PaySheet extends ConsumerStatefulWidget {
  const _PaySheet({required this.title, required this.intro, required this.run});

  final String title;
  final String intro;

  /// Lance le paiement et renvoie l’id du paiement
  final Future<String> Function(ApiClient api, String phone) run;

  @override
  ConsumerState<_PaySheet> createState() => _PaySheetState();
}

class _PaySheetState extends ConsumerState<_PaySheet> {
  late final _phone = TextEditingController(
    text: ref.read(sessionProvider)?.phone ?? '',
  );
  bool _busy = false;
  String? _message;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  Future<void> _pay() async {
    final api = ref.read(apiClientProvider);
    final phone = _phone.text.replaceAll(' ', '').trim();
    if (!RegExp(r'^\+?[0-9]{9,15}$').hasMatch(phone)) {
      setState(() => _error = 'Indiquez un numéro Mobile Money valide.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _message = 'Validez le paiement sur votre téléphone…';
    });
    try {
      final paymentId = await widget.run(api, phone);
      final ok = await waitForStatusPayment(
        api,
        paymentId,
        cancelled: () => !mounted,
      );
      if (!mounted) return;
      if (ok) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Paiement confirmé')));
      } else {
        setState(
          () => _message =
              'Paiement toujours en attente. Tirez la liste vers le bas '
              'dans quelques minutes pour actualiser.',
        );
      }
    } catch (e) {
      if (mounted) setState(() => _error = api.apiError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        0,
        20,
        24 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.title, style: AppTheme.displayText(size: 22)),
          const SizedBox(height: 6),
          Text(widget.intro, style: AppTheme.sansText(size: 14, height: 1.4)),
          const SizedBox(height: 16),
          MobileMoneyField(controller: _phone, enabled: !_busy),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          if (_message != null) ...[
            const SizedBox(height: 16),
            StatusProgressLine(text: _message!, progress: _busy ? null : 1),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _busy ? null : _pay,
            style: FilledButton.styleFrom(
              backgroundColor: AppTheme.gold,
              foregroundColor: const Color(0xFF0B0B0B),
              minimumSize: const Size.fromHeight(50),
            ),
            child: Text(_busy ? 'Paiement en cours…' : 'Payer'),
          ),
        ],
      ),
    );
  }
}
