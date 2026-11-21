import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api.dart';
import '../../core/models.dart';
import '../../theme/app_theme.dart';
import '../../widgets/cover.dart';
import '../account/account_palette.dart';
import 'web_checkout.dart';

/// Achat d’un numéro ou abonnement à toute la plateforme.
/// Le paiement se fait hors de l’app, sur la page web /paiement.
class PurchaseScreen extends ConsumerStatefulWidget {
  const PurchaseScreen({super.key, required this.magazineId});

  final String magazineId;

  @override
  ConsumerState<PurchaseScreen> createState() => _PurchaseScreenState();
}

class _PurchaseScreenState extends ConsumerState<PurchaseScreen> {
  MagazineCard? _magazine;
  List<SubscriptionPlan> _plans = const [];
  bool _loading = true;

  /// Clé de l’option en cours de paiement (magazine ou id de formule).
  String? _busyKey;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = ref.read(apiClientProvider);
    try {
      final results = await Future.wait([
        api.magazine(widget.magazineId),
        api.plans().catchError((_) => const <SubscriptionPlan>[]),
      ]);
      setState(() {
        _magazine = results[0] as MagazineCard;
        _plans = results[1] as List<SubscriptionPlan>;
      });
    } catch (e) {
      setState(() => _error = api.apiError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pay({required String key, SubscriptionPlan? plan}) async {
    if (ref.read(sessionProvider) == null) {
      context.push('/connexion');
      return;
    }
    final api = ref.read(apiClientProvider);
    setState(() {
      _busyKey = key;
      _error = null;
    });
    try {
      final paid = await payOnWeb(
        context,
        ref,
        kind: plan != null ? 'SUBSCRIPTION' : 'MAGAZINE',
        planId: plan?.id,
        magazineId: plan == null ? widget.magazineId : null,
      );
      if (paid && mounted) context.go('/magazine/${widget.magazineId}');
    } catch (e) {
      if (mounted) setState(() => _error = api.apiError(e));
    } finally {
      if (mounted) setState(() => _busyKey = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = AccountPalette.of(context);
    final mag = _magazine;
    final price = mag?.priceCents;
    return Scaffold(
      backgroundColor: p.bg,
      appBar: AppBar(
        backgroundColor: p.bg,
        surfaceTintColor: Colors.transparent,
        title: const Text('Accéder au numéro'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
              children: [
                if (mag != null) ...[
                  Center(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: SizedBox(
                        width: 150,
                        height: 206,
                        child: Cover(url: mag.coverUrl),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    mag.title,
                    textAlign: TextAlign.center,
                    style: AppTheme.displayText(
                      size: 21,
                      weight: FontWeight.w800,
                    ).copyWith(color: p.fg),
                  ),
                  const SizedBox(height: 22),
                  if (price != null && price > 0)
                    _Option(
                      palette: p,
                      icon: LucideIcons.bookOpen,
                      title: 'Acheter ce numéro',
                      subtitle: 'Lecture illimitée de ce numéro',
                      price: formatStatusPrice(price, mag.currency),
                      highlighted: true,
                      busy: _busyKey == 'magazine',
                      enabled: _busyKey == null,
                      onTap: () => _pay(key: 'magazine'),
                    ),
                ],
                if (_plans.isNotEmpty) ...[
                  Padding(
                    padding: const EdgeInsets.fromLTRB(6, 18, 6, 10),
                    child: Text(
                      'OU ABONNEZ-VOUS À TOUTE LA PLATEFORME',
                      style: AppTheme.sansText(
                        size: 12,
                        weight: FontWeight.w700,
                        color: p.muted,
                      ).copyWith(letterSpacing: 1.1),
                    ),
                  ),
                  for (final plan in _plans)
                    _Option(
                      palette: p,
                      icon: LucideIcons.sparkles,
                      title: plan.name,
                      subtitle:
                          plan.description ??
                          'Articles, magazines et vidéos pendant '
                              '${plan.durationDays} jours',
                      price: plan.priceLabel,
                      busy: _busyKey == plan.id,
                      enabled: _busyKey == null,
                      onTap: () => _pay(key: plan.id, plan: plan),
                    ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    textAlign: TextAlign.center,
                    style: AppTheme.sansText(
                      size: 14,
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(LucideIcons.lock, size: 14, color: p.muted),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        'Paiement Mobile Money sur notre page web sécurisée',
                        textAlign: TextAlign.center,
                        style: AppTheme.sansText(size: 12.5, color: p.muted),
                      ),
                    ),
                  ],
                ),
              ],
            ),
    );
  }
}

class _Option extends StatelessWidget {
  const _Option({
    required this.palette,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.price,
    required this.busy,
    required this.enabled,
    required this.onTap,
    this.highlighted = false,
  });

  final AccountPalette palette;
  final IconData icon;
  final String title;
  final String subtitle;
  final String price;
  final bool busy;
  final bool enabled;
  final bool highlighted;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: highlighted ? AppTheme.gold.withValues(alpha: 0.10) : p.group,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(
            color: highlighted ? AppTheme.gold : Colors.transparent,
            width: 1.4,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: enabled ? onTap : null,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 16, 14),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: highlighted
                        ? AppTheme.gold.withValues(alpha: 0.18)
                        : p.iconBg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, size: 20, color: AppTheme.gold),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: AppTheme.sansText(
                          size: 15,
                          weight: FontWeight.w700,
                          color: p.fg,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: AppTheme.sansText(
                          size: 13,
                          height: 1.35,
                          color: p.muted,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                busy
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        price,
                        style: AppTheme.sansText(
                          size: 14.5,
                          weight: FontWeight.w800,
                          color: p.fg,
                        ),
                      ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
