import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../theme/app_theme.dart';
import '../account/account_palette.dart';

/// Paiement hors de l’app : crée une session, ouvre la page web
/// `fintechmedias.com/paiement/<id>` dans le navigateur, puis attend le
/// retour de l’abonné.
///
/// Renvoie `true` quand le paiement est confirmé, `false` si l’abonné
/// ferme sans payer (ou si le lien expire). Les erreurs de création de la
/// session sont levées.
Future<bool> payOnWeb(
  BuildContext context,
  WidgetRef ref, {
  required String kind,
  String? planId,
  String? magazineId,
  String? articleId,
  String? statusId,
}) async {
  final api = ref.read(apiClientProvider);
  final session = await api.createCheckout(
    kind: kind,
    planId: planId,
    magazineId: magazineId,
    articleId: articleId,
    statusId: statusId,
  );
  await _open(session.url);
  if (!context.mounted) return false;
  final paid = await showModalBottomSheet<bool>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    isDismissible: false,
    enableDrag: false,
    backgroundColor: AccountPalette.of(context).bg,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (_) => _WebCheckoutSheet(id: session.id, url: session.url),
  );
  return paid ?? false;
}

Future<void> _open(String url) =>
    launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);

class _WebCheckoutSheet extends ConsumerStatefulWidget {
  const _WebCheckoutSheet({required this.id, required this.url});

  final String id;
  final String url;

  @override
  ConsumerState<_WebCheckoutSheet> createState() => _WebCheckoutSheetState();
}

class _WebCheckoutSheetState extends ConsumerState<_WebCheckoutSheet>
    with WidgetsBindingObserver {
  String _state = 'OPEN';
  bool _checking = false;
  String? _hint;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Confirmation par webhook ou par interrogation de FlexPaie
    _timer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => _refresh(check: true),
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refresh(check: true);
  }

  Future<void> _refresh({bool check = false, bool manual = false}) async {
    if (_checking || !mounted) return;
    setState(() {
      _checking = manual;
      if (manual) _hint = null;
    });
    try {
      final state = await ref
          .read(apiClientProvider)
          .checkoutState(widget.id, check: check);
      if (!mounted) return;
      setState(() => _state = state);
      if (state == 'PAID') {
        _timer?.cancel();
        await Future<void>.delayed(const Duration(milliseconds: 900));
        if (mounted) Navigator.of(context).pop(true);
        return;
      }
      if (state == 'EXPIRED' || state == 'CANCELLED') _timer?.cancel();
      if (manual && state == 'OPEN') {
        setState(
          () => _hint =
              'Paiement pas encore confirmé. Terminez-le sur la page web, '
              'puis revenez ici.',
        );
      }
    } catch (_) {
      if (manual && mounted) {
        setState(() => _hint = 'Vérification impossible. Réessayez.');
      }
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = AccountPalette.of(context);
    final paid = _state == 'PAID';
    final closed = _state == 'EXPIRED' || _state == 'CANCELLED';
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 28, 24, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 250),
              child: Container(
                key: ValueKey(_state),
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: paid
                      ? AppTheme.gold
                      : AppTheme.gold.withValues(alpha: closed ? 0 : 0.14),
                  border: closed ? Border.all(color: p.divider) : null,
                ),
                child: Icon(
                  paid
                      ? LucideIcons.check
                      : closed
                      ? LucideIcons.clock
                      : LucideIcons.globe,
                  size: 30,
                  color: paid
                      ? const Color(0xFF0B0B0B)
                      : closed
                      ? p.muted
                      : AppTheme.gold,
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              paid
                  ? 'Paiement confirmé'
                  : closed
                  ? 'Lien de paiement expiré'
                  : 'Finalisez le paiement',
              textAlign: TextAlign.center,
              style: AppTheme.displayText(
                size: 22,
                weight: FontWeight.w700,
              ).copyWith(color: p.fg),
            ),
            const SizedBox(height: 8),
            Text(
              paid
                  ? 'Merci ! Votre achat est actif.'
                  : closed
                  ? 'Relancez le paiement pour obtenir un nouveau lien.'
                  : 'La page de paiement sécurisée s’est ouverte dans votre '
                        'navigateur. Payez par Mobile Money puis revenez dans '
                        'l’app : la confirmation s’affiche ici.',
              textAlign: TextAlign.center,
              style: AppTheme.sansText(size: 15, height: 1.45, color: p.muted),
            ),
            if (!paid && !closed) ...[
              const SizedBox(height: 18),
              ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: LinearProgressIndicator(
                  minHeight: 3,
                  color: AppTheme.gold,
                  backgroundColor: p.iconBg,
                ),
              ),
            ],
            if (_hint != null) ...[
              const SizedBox(height: 14),
              Text(
                _hint!,
                textAlign: TextAlign.center,
                style: AppTheme.sansText(size: 13.5, height: 1.4, color: p.fg),
              ),
            ],
            const SizedBox(height: 22),
            if (!paid && !closed) ...[
              FilledButton.icon(
                onPressed: () => _open(widget.url),
                icon: const Icon(LucideIcons.externalLink, size: 18),
                label: const Text('Rouvrir la page de paiement'),
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.gold,
                  foregroundColor: const Color(0xFF0B0B0B),
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  textStyle: AppTheme.sansText(
                    size: 16,
                    weight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              OutlinedButton(
                onPressed: _checking
                    ? null
                    : () => _refresh(check: true, manual: true),
                style: OutlinedButton.styleFrom(
                  foregroundColor: p.fg,
                  side: BorderSide(color: p.divider),
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  textStyle: AppTheme.sansText(
                    size: 15.5,
                    weight: FontWeight.w600,
                  ),
                ),
                child: _checking
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('J’ai payé, vérifier'),
              ),
            ],
            if (!paid)
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: Text(
                  closed ? 'Fermer' : 'Payer plus tard',
                  style: AppTheme.sansText(
                    size: 15,
                    weight: FontWeight.w600,
                    color: p.muted,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
