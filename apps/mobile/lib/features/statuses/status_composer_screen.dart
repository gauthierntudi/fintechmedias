import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api.dart';
import '../../core/models.dart';
import '../../theme/app_theme.dart';
import 'status_payment.dart';

/// Ouvre l’écran de création d’un statut (ou de correction d’un statut refusé).
Future<void> openStatusComposer(BuildContext context, {MyStatus? edit}) {
  return context.push('/statut/nouveau', extra: edit);
}

/// Limites alignées sur l’API (10 Mo image, 100 Mo vidéo).
const _imageMaxBytes = 10 * 1000 * 1000;
const _videoMaxBytes = 100 * 1000 * 1000;

/// Offres et forfaits nécessaires à l’étape « Publication ».
final _billingProvider = FutureProvider.autoDispose((ref) async {
  final api = ref.watch(apiClientProvider);
  final results = await Future.wait([api.statusOffers(), api.myStatusPasses()]);
  return (
    offers: results[0] as List<StatusOffer>,
    passes: results[1] as StatusPasses,
  );
});

/// Choix de financement à l’étape 2.
sealed class _Billing {
  const _Billing();
}

/// Décompte sur le forfait actif
class _UsePass extends _Billing {
  const _UsePass();
}

/// Publication unique payée à l’acte
class _PaySingle extends _Billing {
  const _PaySingle(this.offer);
  final StatusOffer offer;
}

/// Achat d’un forfait, puis publication dessus
class _BuyPass extends _Billing {
  const _BuyPass(this.offer);
  final StatusOffer offer;
}

/// Création d’un statut abonné en 2 étapes :
/// 1. média (image ou vidéo), légende et lien ;
/// 2. financement (forfait / publication unique / achat de forfait) et envoi
///    à la rédaction, qui valide avant la mise en ligne.
class StatusComposerScreen extends ConsumerStatefulWidget {
  const StatusComposerScreen({super.key, this.edit});

  /// Statut refusé à corriger (média remplacé puis resoumis)
  final MyStatus? edit;

  @override
  ConsumerState<StatusComposerScreen> createState() =>
      _StatusComposerScreenState();
}

class _StatusComposerScreenState extends ConsumerState<StatusComposerScreen> {
  final _picker = ImagePicker();
  final _caption = TextEditingController();
  final _link = TextEditingController();
  final _phone = TextEditingController();

  XFile? _media;
  bool _isVideo = false;
  int _mediaSize = 0;

  int _step = 0;
  _Billing? _billing;
  bool _busy = false;
  String? _error;
  String? _progressText;
  double? _progress;
  bool _done = false;
  bool _paymentPending = false;

  /// Statut créé côté serveur (réutilisé si l’abonné réessaie)
  String? _statusId;

  /// Diapo créée (réutilisée si l’envoi du média doit être relancé)
  String? _slideId;
  bool _oldSlidesCleared = false;
  bool _mediaSent = false;

  bool get _resubmitFree => widget.edit?.resubmitWithoutPayment ?? false;

  @override
  void initState() {
    super.initState();
    final edit = widget.edit;
    if (edit != null) {
      _statusId = edit.id;
      final first = edit.slides.isEmpty ? null : edit.slides.first;
      _caption.text = first?.caption ?? '';
      _link.text = first?.linkUrl ?? '';
    }
    _phone.text = ref.read(sessionProvider)?.phone ?? '';
  }

  @override
  void dispose() {
    _caption.dispose();
    _link.dispose();
    _phone.dispose();
    super.dispose();
  }

  // ------------------------------------------------------------ média

  Future<void> _pick({required bool video, required bool camera}) async {
    Navigator.of(context).maybePop();
    try {
      final source = camera ? ImageSource.camera : ImageSource.gallery;
      final file = video
          ? await _picker.pickVideo(
              source: source,
              maxDuration: const Duration(seconds: 60),
            )
          : await _picker.pickImage(
              source: source,
              imageQuality: 85,
              maxWidth: 1920,
              maxHeight: 1920,
            );
      if (file == null) return;
      final size = await file.length();
      final max = video ? _videoMaxBytes : _imageMaxBytes;
      if (size > max) {
        setState(
          () => _error = video
              ? 'La vidéo dépasse 100 Mo.'
              : 'L’image dépasse 10 Mo.',
        );
        return;
      }
      final name = file.path.toLowerCase();
      if (video &&
          !(name.endsWith('.mp4') ||
              name.endsWith('.mov') ||
              name.endsWith('.m4v'))) {
        setState(() => _error = 'Formats vidéo acceptés : MP4 ou MOV.');
        return;
      }
      setState(() {
        _media = file;
        _isVideo = video;
        _mediaSize = size;
        _mediaSent = false;
        _error = null;
      });
    } catch (e) {
      setState(
        () => _error =
            'Impossible d’accéder aux médias. Vérifiez les autorisations.',
      );
    }
  }

  void _openPicker() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      useSafeArea: true,
      builder: (ctx) => SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(LucideIcons.image),
              title: const Text('Photo de la galerie'),
              onTap: () => _pick(video: false, camera: false),
            ),
            ListTile(
              leading: const Icon(LucideIcons.film),
              title: const Text('Vidéo de la galerie'),
              subtitle: const Text('60 s max · 100 Mo'),
              onTap: () => _pick(video: true, camera: false),
            ),
            ListTile(
              leading: const Icon(LucideIcons.camera),
              title: const Text('Prendre une photo'),
              onTap: () => _pick(video: false, camera: true),
            ),
            ListTile(
              leading: const Icon(LucideIcons.video),
              title: const Text('Filmer une vidéo'),
              onTap: () => _pick(video: true, camera: true),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  String? _validateStep1() {
    if (_media == null) return 'Choisissez une image ou une vidéo.';
    final link = _link.text.trim();
    if (link.isNotEmpty) {
      final uri = Uri.tryParse(link);
      if (uri == null ||
          !(uri.scheme == 'https' || uri.scheme == 'http') ||
          uri.host.isEmpty) {
        return 'Lien invalide : il doit commencer par https://';
      }
    }
    return null;
  }

  void _next() {
    final err = _validateStep1();
    if (err != null) {
      setState(() => _error = err);
      return;
    }
    setState(() {
      _error = null;
      _step = 1;
    });
  }

  // ------------------------------------------------------------ envoi

  /// Crée le statut (ou vide le statut refusé), ajoute la diapo et envoie
  /// le média. Ignoré si déjà fait lors d’une tentative précédente.
  Future<String> _ensureUploaded(ApiClient api) async {
    var statusId = _statusId;
    if (statusId != null && _mediaSent) return statusId;

    if (statusId == null) {
      setState(() => _progressText = 'Création du statut…');
      statusId = await api.createMyStatus();
      _statusId = statusId;
    } else if (widget.edit != null && !_oldSlidesCleared) {
      // Correction : les anciennes diapos sont remplacées
      for (final slide in widget.edit!.slides) {
        await api.deleteMyStatusSlide(slide.id);
      }
      _oldSlidesCleared = true;
    }

    final slideId = _slideId ??= await api.addMyStatusSlide(
      statusId,
      caption: _caption.text.trim(),
      linkUrl: _link.text.trim(),
    );
    final media = _media!;
    void report(double p) {
      if (!mounted) return;
      setState(() {
        _progress = p;
        _progressText = 'Envoi du média… ${(p * 100).round()} %';
      });
    }

    report(0);
    if (_isVideo) {
      await api.uploadMyStatusVideo(
        slideId,
        media.path,
        _mediaSize,
        onProgress: report,
      );
    } else {
      await api.uploadMyStatusImage(slideId, media.path, onProgress: report);
    }
    _mediaSent = true;
    return statusId;
  }

  Future<void> _publish() async {
    final api = ref.read(apiClientProvider);
    final billing = _billing;
    if (!_resubmitFree && billing == null) {
      setState(() => _error = 'Choisissez comment publier votre statut.');
      return;
    }
    final needsPhone = billing is _PaySingle || billing is _BuyPass;
    final phone = _phone.text.trim();
    if (!_resubmitFree &&
        needsPhone &&
        !RegExp(r'^\+?[0-9]{9,15}$').hasMatch(phone.replaceAll(' ', ''))) {
      setState(() => _error = 'Indiquez un numéro Mobile Money valide.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
      _progress = null;
    });
    try {
      final statusId = await _ensureUploaded(api);
      if (!mounted) return;
      setState(() {
        _progress = null;
        _progressText = 'Envoi à la rédaction…';
      });

      if (_resubmitFree) {
        // Déjà payé : le serveur ignore le mode de financement
        await api.submitMyStatus(statusId, billing: 'SINGLE');
      } else if (billing is _UsePass) {
        await api.submitMyStatus(statusId, billing: 'PASS');
      } else if (billing is _PaySingle) {
        final paymentId = await api.submitMyStatus(
          statusId,
          billing: 'SINGLE',
          offerId: billing.offer.id,
          phone: phone.replaceAll(' ', ''),
        );
        setState(
          () => _progressText =
              'Validez le paiement sur votre téléphone (${billing.offer.priceLabel})…',
        );
        final ok = await waitForStatusPayment(
          api,
          paymentId ?? '',
          cancelled: () => !mounted,
        );
        _paymentPending = !ok;
      } else if (billing is _BuyPass) {
        setState(
          () => _progressText =
              'Validez le paiement du forfait sur votre téléphone (${billing.offer.priceLabel})…',
        );
        final paymentId = await api.checkoutStatusPass(
          billing.offer.id,
          phone.replaceAll(' ', ''),
        );
        final ok = await waitForStatusPayment(
          api,
          paymentId,
          cancelled: () => !mounted,
        );
        if (!ok) {
          // Forfait pas encore confirmé : le statut reste en brouillon
          _paymentPending = true;
        } else {
          await api.submitMyStatus(statusId, billing: 'PASS');
        }
      }
      if (!mounted) return;
      setState(() => _done = true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = api.apiError(e));
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _progressText = null;
          _progress = null;
        });
      }
    }
  }

  // ------------------------------------------------------------ UI

  @override
  Widget build(BuildContext context) {
    final title = widget.edit != null ? 'Corriger le statut' : 'Nouveau statut';
    return PopScope(
      canPop: !_busy,
      child: Scaffold(
        appBar: AppBar(
          title: Text(title),
          leading: _step == 1 && !_done
              ? IconButton(
                  icon: const Icon(LucideIcons.arrowLeft),
                  tooltip: 'Retour',
                  onPressed: _busy ? null : () => setState(() => _step = 0),
                )
              : null,
        ),
        body: SafeArea(
          child: _done
              ? _DoneView(paymentPending: _paymentPending)
              : _step == 0
              ? _buildMediaStep(context)
              : _buildBillingStep(context),
        ),
      ),
    );
  }

  Widget _buildMediaStep(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final media = _media;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      children: [
        if (widget.edit?.refusalReason != null) ...[
          _Notice(
            icon: LucideIcons.circleAlert,
            text: 'Refusé : ${widget.edit!.refusalReason}',
          ),
          const SizedBox(height: 16),
        ],
        // Aperçu vertical, plafonné à ~45 % de l'écran pour que le texte,
        // le lien et « Continuer » restent visibles sans défiler.
        Center(
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(context).height * 0.45,
            ),
            child: AspectRatio(
              aspectRatio: 9 / 14,
              child: Material(
                color: scheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(18),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: _busy ? null : _openPicker,
                  child: media == null
                      ? Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              LucideIcons.imagePlus,
                              size: 44,
                              color: scheme.onSurfaceVariant,
                            ),
                            const SizedBox(height: 12),
                            Text(
                              'Ajouter une image ou une vidéo',
                              style: AppTheme.sansText(
                                size: 15,
                                weight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Format vertical conseillé',
                              style: AppTheme.sansText(
                                size: 13,
                                color: scheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        )
                      : Stack(
                          fit: StackFit.expand,
                          children: [
                            if (_isVideo)
                              ColoredBox(
                                color: Colors.black,
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Icon(
                                      LucideIcons.circlePlay,
                                      size: 56,
                                      color: Colors.white,
                                    ),
                                    const SizedBox(height: 10),
                                    Text(
                                      'Vidéo · ${(_mediaSize / 1e6).toStringAsFixed(1)} Mo',
                                      style: AppTheme.sansText(
                                        size: 14,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ],
                                ),
                              )
                            else
                              Image.file(File(media.path), fit: BoxFit.cover),
                            Positioned(
                              right: 12,
                              bottom: 12,
                              child: FilledButton.tonalIcon(
                                onPressed: _busy ? null : _openPicker,
                                icon: const Icon(LucideIcons.repeat, size: 16),
                                label: const Text('Changer'),
                              ),
                            ),
                          ],
                        ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 20),
        TextField(
          controller: _caption,
          maxLength: 500,
          maxLines: 3,
          minLines: 1,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(
            labelText: 'Texte (optionnel)',
            hintText: 'Message affiché sur votre statut',
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _link,
          keyboardType: TextInputType.url,
          autocorrect: false,
          decoration: const InputDecoration(
            labelText: 'Lien (optionnel)',
            hintText: 'https://votre-site.com',
            helperText: 'Affiché en bouton « En savoir plus »',
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 16),
          _ErrorText(_error!),
        ],
        const SizedBox(height: 24),
        FilledButton(
          onPressed: _busy ? null : _next,
          style: FilledButton.styleFrom(
            backgroundColor: AppTheme.gold,
            foregroundColor: const Color(0xFF0B0B0B),
            minimumSize: const Size.fromHeight(50),
          ),
          child: const Text('Continuer'),
        ),
      ],
    );
  }

  Widget _buildBillingStep(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final async = ref.watch(_billingProvider);
    final needsPhone = _billing is _PaySingle || _billing is _BuyPass;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      children: [
        Text('Publication', style: AppTheme.displayText(size: 22)),
        const SizedBox(height: 6),
        Text(
          'Votre statut est vérifié par la rédaction avant d’apparaître en '
          'tête de l’accueil avec la mention « Sponsorisé ».',
          style: AppTheme.sansText(
            size: 14,
            height: 1.4,
            color: scheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 18),
        if (_resubmitFree)
          const _Notice(
            icon: LucideIcons.badgeCheck,
            text:
                'Votre publication est déjà payée : le statut corrigé est '
                'renvoyé à la rédaction sans nouveau paiement.',
          )
        else
          async.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (e, _) => Column(
              children: [
                _ErrorText(ref.read(apiClientProvider).apiError(e)),
                TextButton(
                  onPressed: () => ref.invalidate(_billingProvider),
                  child: const Text('Réessayer'),
                ),
              ],
            ),
            data: (data) => _BillingOptions(
              offers: data.offers,
              passes: data.passes,
              selected: _billing,
              enabled: !_busy,
              onSelect: (b) => setState(() {
                _billing = b;
                _error = null;
              }),
            ),
          ),
        if (needsPhone && !_resubmitFree) ...[
          const SizedBox(height: 16),
          MobileMoneyField(controller: _phone, enabled: !_busy),
        ],
        if (_error != null) ...[
          const SizedBox(height: 16),
          _ErrorText(_error!),
        ],
        const SizedBox(height: 24),
        if (_busy && _progressText != null) ...[
          StatusProgressLine(text: _progressText!, progress: _progress),
          const SizedBox(height: 16),
        ],
        FilledButton(
          onPressed: _busy ? null : _publish,
          style: FilledButton.styleFrom(
            backgroundColor: AppTheme.gold,
            foregroundColor: const Color(0xFF0B0B0B),
            minimumSize: const Size.fromHeight(50),
          ),
          child: Text(_publishLabel),
        ),
      ],
    );
  }

  String get _publishLabel {
    if (_resubmitFree) return 'Renvoyer à la rédaction';
    final b = _billing;
    if (b is _PaySingle) return 'Payer ${b.offer.priceLabel} et publier';
    if (b is _BuyPass) return 'Acheter le forfait (${b.offer.priceLabel})';
    return 'Publier';
  }
}

/// Liste des modes de financement disponibles.
class _BillingOptions extends StatelessWidget {
  const _BillingOptions({
    required this.offers,
    required this.passes,
    required this.selected,
    required this.enabled,
    required this.onSelect,
  });

  final List<StatusOffer> offers;
  final StatusPasses passes;
  final _Billing? selected;
  final bool enabled;
  final ValueChanged<_Billing> onSelect;

  @override
  Widget build(BuildContext context) {
    final singles = offers.where((o) => !o.isPass).toList();
    final packs = offers.where((o) => o.isPass).toList();
    if (!passes.hasActivePass && offers.isEmpty) {
      return const _Notice(
        icon: LucideIcons.clock,
        text:
            'La publication de statuts n’est pas encore ouverte. '
            'Revenez bientôt !',
      );
    }
    final until = passes.activeUntil;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (passes.hasActivePass)
          _OptionTile(
            icon: LucideIcons.badgeCheck,
            title: 'Utiliser mon forfait',
            subtitle: [
              passes.remaining == null
                  ? 'Publications illimitées'
                  : '${passes.remaining} publication${(passes.remaining ?? 0) > 1 ? 's' : ''} restante${(passes.remaining ?? 0) > 1 ? 's' : ''}',
              if (until != null)
                'jusqu’au ${until.day.toString().padLeft(2, '0')}/${until.month.toString().padLeft(2, '0')}',
            ].join(' · '),
            trailing: 'Inclus',
            selected: selected is _UsePass,
            enabled: enabled,
            onTap: () => onSelect(const _UsePass()),
          ),
        for (final o in singles)
          _OptionTile(
            icon: LucideIcons.zap,
            title: o.label,
            subtitle: o.description ?? o.detail,
            trailing: o.priceLabel,
            selected:
                selected is _PaySingle &&
                (selected as _PaySingle).offer.id == o.id,
            enabled: enabled,
            onTap: () => onSelect(_PaySingle(o)),
          ),
        if (packs.isNotEmpty && !passes.hasActivePass) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(2, 14, 2, 8),
            child: Text(
              'Ou prenez un forfait',
              style: AppTheme.sansText(size: 13, weight: FontWeight.w700),
            ),
          ),
          for (final o in packs)
            _OptionTile(
              icon: LucideIcons.layers,
              title: o.label,
              subtitle: o.description ?? o.detail,
              trailing: o.priceLabel,
              selected:
                  selected is _BuyPass &&
                  (selected as _BuyPass).offer.id == o.id,
              enabled: enabled,
              onTap: () => onSelect(_BuyPass(o)),
            ),
        ],
      ],
    );
  }
}

class _OptionTile extends StatelessWidget {
  const _OptionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.trailing,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String trailing;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: selected
            ? AppTheme.gold.withValues(alpha: 0.12)
            : Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(
            color: selected ? AppTheme.gold : scheme.outlineVariant,
            width: selected ? 1.6 : 1,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: enabled ? onTap : null,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Icon(icon, size: 22, color: AppTheme.gold),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: AppTheme.sansText(
                          size: 15,
                          weight: FontWeight.w600,
                          height: 1.3,
                        ),
                      ),
                      Text(
                        subtitle,
                        style: AppTheme.sansText(
                          size: 13,
                          height: 1.3,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  trailing,
                  style: AppTheme.sansText(
                    size: 14,
                    weight: FontWeight.w700,
                    height: 1.2,
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

/// Écran final : statut envoyé (ou paiement encore en attente).
class _DoneView extends StatelessWidget {
  const _DoneView({required this.paymentPending});

  final bool paymentPending;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            paymentPending ? LucideIcons.hourglass : LucideIcons.circleCheck,
            size: 64,
            color: AppTheme.gold,
          ),
          const SizedBox(height: 18),
          Text(
            paymentPending ? 'Paiement en attente' : 'Statut envoyé !',
            textAlign: TextAlign.center,
            style: AppTheme.displayText(size: 24),
          ),
          const SizedBox(height: 10),
          Text(
            paymentPending
                ? 'Nous n’avons pas encore reçu la confirmation de votre '
                      'paiement. Retrouvez votre statut dans « Mes statuts » '
                      'pour suivre ou relancer le paiement.'
                : 'La rédaction vérifie votre statut. Il apparaîtra en tête '
                      'de l’accueil dès sa validation.',
            textAlign: TextAlign.center,
            style: AppTheme.sansText(
              size: 15,
              height: 1.45,
              color: scheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 28),
          FilledButton(
            onPressed: () => context.pushReplacement('/mes-statuts'),
            style: FilledButton.styleFrom(
              backgroundColor: AppTheme.gold,
              foregroundColor: const Color(0xFF0B0B0B),
              minimumSize: const Size.fromHeight(50),
            ),
            child: const Text('Voir mes statuts'),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () => context.pop(),
            child: const Text('Retour à l’accueil'),
          ),
        ],
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: AppTheme.gold),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text, style: AppTheme.sansText(size: 14, height: 1.4)),
          ),
        ],
      ),
    );
  }
}

class _ErrorText extends StatelessWidget {
  const _ErrorText(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return Text(
      message,
      textAlign: TextAlign.center,
      style: AppTheme.sansText(
        size: 14,
        height: 1.35,
        color: Theme.of(context).colorScheme.error,
      ),
    );
  }
}
