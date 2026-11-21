import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:pro_video_editor/pro_video_editor.dart' as pve;

import '../../core/api.dart';
import '../../core/models.dart';
import '../../theme/app_theme.dart';
import '../account/account_palette.dart';
import '../editor/photo_editor.dart';
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

  /// Fichier choisi avant retouche (pour pouvoir retoucher à nouveau).
  File? _source;
  bool _isVideo = false;

  /// Première image et durée de la vidéo retenue (aperçu).
  Uint8List? _videoPoster;
  Duration? _videoDuration;
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
      final name = file.path.toLowerCase();
      if (video &&
          !(name.endsWith('.mp4') ||
              name.endsWith('.mov') ||
              name.endsWith('.m4v'))) {
        setState(() => _error = 'Formats vidéo acceptés : MP4 ou MOV.');
        return;
      }
      await _edit(File(file.path), video: video);
    } catch (e) {
      setState(
        () => _error =
            'Impossible d’accéder aux médias. Vérifiez les autorisations.',
      );
    }
  }

  /// Ouvre l'éditeur (photo 9:16 ou vidéo) puis retient le résultat.
  Future<void> _edit(File source, {required bool video}) async {
    if (!mounted) return;
    final edited = video
        ? await openVideoEditor(context, source)
        : await openPhotoEditor(
            context,
            source,
            aspect: 9 / 16,
            round: false,
            discardMessage: 'L’image ne sera pas ajoutée au statut.',
          );
    if (edited == null || !mounted) return;
    final size = await edited.length();
    final max = video ? _videoMaxBytes : _imageMaxBytes;
    if (size > max) {
      setState(
        () => _error = video
            ? 'La vidéo dépasse 100 Mo : coupez-la davantage.'
            : 'L’image dépasse 10 Mo.',
      );
      return;
    }
    Uint8List? poster;
    Duration? duration;
    if (video) {
      try {
        final v = pve.EditorVideo.file(edited);
        duration = (await pve.ProVideoEditor.instance.getMetadata(v)).duration;
        final thumbs = await pve.ProVideoEditor.instance.getThumbnails(
          pve.ThumbnailConfigs(
            video: v,
            outputSize: const Size(540, 960),
            timestamps: const [Duration(milliseconds: 300)],
          ),
        );
        poster = thumbs.isEmpty ? null : thumbs.first;
      } catch (_) {}
      if (!mounted) return;
    }
    setState(() {
      _videoPoster = poster;
      _videoDuration = duration;
      _source = source;
      _media = XFile(edited.path);
      _isVideo = video;
      _mediaSize = size;
      _mediaSent = false;
      _error = null;
    });
  }

  void _openPicker() {
    final p = AccountPalette.of(context);
    showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      backgroundColor: p.group,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => _PickerSheet(
        palette: p,
        onPick: (video, camera) {
          Navigator.of(ctx).pop();
          _pick(video: video, camera: camera);
        },
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
    final p = AccountPalette.of(context);
    return PopScope(
      canPop: !_busy,
      child: Scaffold(
        backgroundColor: p.bg,
        appBar: AppBar(
          backgroundColor: p.bg,
          surfaceTintColor: Colors.transparent,
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
    final p = AccountPalette.of(context);
    final media = _media;
    final previewMax = MediaQuery.sizeOf(context).height * 0.46;

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
            children: [
              _StepHeader(
                palette: p,
                step: 1,
                title: 'Votre média',
                subtitle:
                    'Une photo ou une vidéo verticale, retouchée '
                    'avant publication.',
              ),
              if (widget.edit?.refusalReason != null) ...[
                const SizedBox(height: 16),
                _Notice(
                  icon: LucideIcons.circleAlert,
                  text: 'Refusé : ${widget.edit!.refusalReason}',
                ),
              ],
              const SizedBox(height: 18),
              if (media == null)
                SizedBox(
                  height: math.min(previewMax, 330),
                  child: _EmptyMedia(
                    palette: p,
                    enabled: !_busy,
                    onPick: (video, camera) =>
                        _pick(video: video, camera: camera),
                  ),
                )
              else
                Center(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(maxHeight: previewMax),
                    child: AspectRatio(
                      aspectRatio: 9 / 16,
                      child: _MediaPreview(
                        palette: p,
                        path: media.path,
                        isVideo: _isVideo,
                        poster: _videoPoster,
                        duration: _videoDuration,
                        sizeBytes: _mediaSize,
                        onEdit: _busy || _source == null
                            ? null
                            : () => _edit(_source!, video: _isVideo),
                        onChange: _busy ? null : _openPicker,
                      ),
                    ),
                  ),
                ),
              const SizedBox(height: 26),
              _SectionTitle('Détails', palette: p),
              Container(
                decoration: BoxDecoration(
                  color: p.group,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Column(
                  children: [
                    _InlineField(
                      palette: p,
                      icon: LucideIcons.messageSquareText,
                      controller: _caption,
                      hint: 'Ajouter un texte (optionnel)',
                      maxLength: 500,
                      maxLines: 4,
                      capitalization: TextCapitalization.sentences,
                    ),
                    Divider(
                      height: 1,
                      thickness: 1,
                      indent: 54,
                      color: p.divider,
                    ),
                    _InlineField(
                      palette: p,
                      icon: LucideIcons.link,
                      controller: _link,
                      hint: 'https://votre-site.com',
                      keyboard: TextInputType.url,
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(6, 8, 6, 0),
                child: Text(
                  'Le lien s’affiche en bouton « En savoir plus » sur votre '
                  'statut.',
                  style: AppTheme.sansText(size: 12.5, color: p.muted),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                _ErrorText(_error!),
              ],
            ],
          ),
        ),
        _BottomCta(
          palette: p,
          label: 'Continuer',
          enabled: !_busy && media != null,
          onPressed: _next,
        ),
      ],
    );
  }

  Widget _buildBillingStep(BuildContext context) {
    final p = AccountPalette.of(context);
    final async = ref.watch(_billingProvider);
    final needsPhone = _billing is _PaySingle || _billing is _BuyPass;
    final media = _media;

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
            children: [
              _StepHeader(
                palette: p,
                step: 2,
                title: 'Publication',
                subtitle:
                    'Votre statut est vérifié par la rédaction avant '
                    'd’apparaître en tête de l’accueil avec la mention « Sponsorisé ».',
              ),
              if (media != null) ...[
                const SizedBox(height: 18),
                _MediaRecap(
                  palette: p,
                  path: media.path,
                  isVideo: _isVideo,
                  poster: _videoPoster,
                  duration: _videoDuration,
                  sizeBytes: _mediaSize,
                  caption: _caption.text.trim(),
                  onEdit: _busy ? null : () => setState(() => _step = 0),
                ),
              ],
              const SizedBox(height: 22),
              _SectionTitle(
                _resubmitFree ? 'Paiement' : 'Mode de publication',
                palette: p,
              ),
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
              if (_busy && _progressText != null) ...[
                const SizedBox(height: 20),
                StatusProgressLine(text: _progressText!, progress: _progress),
              ],
            ],
          ),
        ),
        _BottomCta(
          palette: p,
          label: _publishLabel,
          icon: LucideIcons.send,
          enabled: !_busy && (_resubmitFree || _billing != null),
          onPressed: _publish,
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
          const SizedBox(height: 14),
          _SectionTitle(
            'Ou prenez un forfait',
            palette: AccountPalette.of(context),
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
    final p = AccountPalette.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: selected ? AppTheme.gold.withValues(alpha: 0.10) : p.group,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(
            color: selected ? AppTheme.gold : Colors.transparent,
            width: 1.6,
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
                    color: selected
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
                          height: 1.3,
                          color: p.fg,
                        ),
                      ),
                      if (subtitle.isNotEmpty) ...[
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
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      trailing,
                      style: AppTheme.sansText(
                        size: 14,
                        weight: FontWeight.w800,
                        height: 1.2,
                        color: p.fg,
                      ),
                    ),
                    const SizedBox(height: 8),
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      width: 20,
                      height: 20,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: selected ? AppTheme.gold : Colors.transparent,
                        border: Border.all(
                          color: selected ? AppTheme.gold : p.muted,
                          width: 1.6,
                        ),
                      ),
                      child: selected
                          ? const Icon(
                              LucideIcons.check,
                              size: 13,
                              color: Color(0xFF0B0B0B),
                            )
                          : null,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Rappel compact du média à l’étape 2.
class _MediaRecap extends StatelessWidget {
  const _MediaRecap({
    required this.palette,
    required this.path,
    required this.isVideo,
    required this.poster,
    required this.duration,
    required this.sizeBytes,
    required this.caption,
    required this.onEdit,
  });

  final AccountPalette palette;
  final String path;
  final bool isVideo;
  final Uint8List? poster;
  final Duration? duration;
  final int sizeBytes;
  final String caption;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    final mo = '${(sizeBytes / 1e6).toStringAsFixed(1)} Mo';
    String kind = isVideo ? 'Vidéo' : 'Photo';
    final d = duration;
    if (isVideo && d != null) {
      final secs = (d.inMilliseconds / 1000).round();
      kind += ' · ${secs ~/ 60}:${(secs % 60).toString().padLeft(2, '0')}';
    }
    final Widget thumb = isVideo
        ? (poster != null
              ? Image.memory(poster!, fit: BoxFit.cover)
              : ColoredBox(color: p.iconBg))
        : Image.file(File(path), fit: BoxFit.cover, cacheWidth: 200);
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: p.group,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: SizedBox(
              width: 54,
              height: 96,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  thumb,
                  if (isVideo)
                    const Center(
                      child: Icon(
                        LucideIcons.play,
                        size: 18,
                        color: Colors.white,
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$kind · $mo',
                  style: AppTheme.sansText(
                    size: 13,
                    weight: FontWeight.w700,
                    color: AppTheme.gold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  caption.isEmpty ? 'Sans texte' : caption,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: AppTheme.sansText(
                    size: 14,
                    height: 1.35,
                    color: caption.isEmpty ? p.muted : p.fg,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: onEdit,
            tooltip: 'Modifier',
            icon: Icon(LucideIcons.pencil, size: 18, color: p.muted),
          ),
        ],
      ),
    );
  }
}

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
    final p = AccountPalette.of(context);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: p.group,
        borderRadius: BorderRadius.circular(16),
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

// ───────────────────────────── Étape média ─────────────────────────────

/// « Étape n sur 2 » + barre segmentée + titre.
class _StepHeader extends StatelessWidget {
  const _StepHeader({
    required this.palette,
    required this.step,
    required this.title,
    required this.subtitle,
  });

  final AccountPalette palette;
  final int step;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            for (var i = 1; i <= 2; i++) ...[
              Expanded(
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  height: 4,
                  decoration: BoxDecoration(
                    color: i <= step ? AppTheme.gold : p.divider,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              if (i < 2) const SizedBox(width: 6),
            ],
          ],
        ),
        const SizedBox(height: 14),
        Text(
          'ÉTAPE $step SUR 2',
          style: AppTheme.sansText(
            size: 11.5,
            weight: FontWeight.w700,
            color: AppTheme.gold,
            letterSpacing: 1.1,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          title,
          style: AppTheme.displayText(
            size: 24,
            weight: FontWeight.w800,
            color: p.fg,
            letterSpacing: -0.4,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: AppTheme.sansText(size: 14, color: p.muted, height: 1.4),
        ),
      ],
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text, {required this.palette});

  final String text;
  final AccountPalette palette;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(6, 0, 6, 10),
      child: Text(
        text.toUpperCase(),
        style: AppTheme.sansText(
          size: 12,
          weight: FontWeight.w700,
          color: palette.muted,
          letterSpacing: 1.1,
        ),
      ),
    );
  }
}

typedef _PickCallback = void Function(bool video, bool camera);

const _pickOptions = <(IconData, String, String, bool, bool)>[
  (LucideIcons.image, 'Photo', 'Galerie', false, false),
  (LucideIcons.film, 'Vidéo', 'Galerie', true, false),
  (LucideIcons.camera, 'Photo', 'Appareil', false, true),
  (LucideIcons.video, 'Filmer', 'Appareil', true, true),
];

/// Zone vide : cadre pointillé + raccourcis galerie / appareil.
class _EmptyMedia extends StatelessWidget {
  const _EmptyMedia({
    required this.palette,
    required this.enabled,
    required this.onPick,
  });

  final AccountPalette palette;
  final bool enabled;
  final _PickCallback onPick;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    return CustomPaint(
      foregroundPainter: _DashedBorderPainter(
        color: p.muted.withValues(alpha: 0.45),
      ),
      child: Container(
        decoration: BoxDecoration(
          color: p.group,
          borderRadius: BorderRadius.circular(22),
        ),
        padding: const EdgeInsets.fromLTRB(14, 18, 14, 18),
        child: Column(
          children: [
            const Spacer(),
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppTheme.gold.withValues(alpha: 0.14),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                LucideIcons.imagePlus,
                size: 28,
                color: AppTheme.gold,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Ajoutez votre média',
              textAlign: TextAlign.center,
              style: AppTheme.displayText(
                size: 17,
                weight: FontWeight.w800,
                color: p.fg,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Format vertical 9:16\nVidéo : 60 s max · 100 Mo',
              textAlign: TextAlign.center,
              style: AppTheme.sansText(size: 12.5, color: p.muted, height: 1.4),
            ),
            const Spacer(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                for (final o in _pickOptions)
                  _QuickPick(
                    palette: p,
                    icon: o.$1,
                    label: o.$2,
                    sub: o.$3,
                    onTap: enabled ? () => onPick(o.$4, o.$5) : null,
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickPick extends StatelessWidget {
  const _QuickPick({
    required this.palette,
    required this.icon,
    required this.label,
    required this.sub,
    required this.onTap,
  });

  final AccountPalette palette;
  final IconData icon;
  final String label;
  final String sub;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    return Semantics(
      button: true,
      label: '$label · $sub',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: SizedBox(
          width: 64,
          child: Column(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: p.iconBg,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 21, color: p.fg),
              ),
              const SizedBox(height: 6),
              Text(
                label,
                maxLines: 1,
                style: AppTheme.sansText(
                  size: 11.5,
                  weight: FontWeight.w700,
                  color: p.fg,
                  height: 1.2,
                ),
              ),
              Text(
                sub,
                maxLines: 1,
                style: AppTheme.sansText(
                  size: 10.5,
                  color: p.muted,
                  height: 1.2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  _DashedBorderPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = RRect.fromRectAndRadius(
      (Offset.zero & size).deflate(0.75),
      const Radius.circular(22),
    );
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    for (final metric in (Path()..addRRect(rrect)).computeMetrics()) {
      var d = 0.0;
      while (d < metric.length) {
        canvas.drawPath(metric.extractPath(d, d + 7), paint);
        d += 13;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorderPainter old) => old.color != color;
}

/// Aperçu du média retenu, avec badges et actions superposés.
class _MediaPreview extends StatelessWidget {
  const _MediaPreview({
    required this.palette,
    required this.path,
    required this.isVideo,
    required this.poster,
    required this.duration,
    required this.sizeBytes,
    required this.onEdit,
    required this.onChange,
  });

  final AccountPalette palette;
  final String path;
  final bool isVideo;
  final Uint8List? poster;
  final Duration? duration;
  final int sizeBytes;
  final VoidCallback? onEdit;
  final VoidCallback? onChange;

  String get _badge {
    final mo = '${(sizeBytes / 1e6).toStringAsFixed(1)} Mo';
    if (!isVideo) return 'Photo · $mo';
    final d = duration;
    if (d == null) return 'Vidéo · $mo';
    final secs = (d.inMilliseconds / 1000).round();
    return 'Vidéo · ${secs ~/ 60}:${(secs % 60).toString().padLeft(2, '0')} · $mo';
  }

  @override
  Widget build(BuildContext context) {
    final Widget visual = isVideo
        ? (poster != null
              ? Image.memory(poster!, fit: BoxFit.cover, gaplessPlayback: true)
              : const ColoredBox(color: Colors.black))
        : Image.file(File(path), fit: BoxFit.cover, gaplessPlayback: true);

    return ClipRRect(
      borderRadius: BorderRadius.circular(22),
      child: Stack(
        fit: StackFit.expand,
        children: [
          visual,
          // Dégradés haut/bas pour la lisibilité des badges.
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: [0, 0.22, 0.7, 1],
                colors: [
                  Color(0x66000000),
                  Color(0x00000000),
                  Color(0x00000000),
                  Color(0x99000000),
                ],
              ),
            ),
          ),
          if (isVideo)
            Center(
              child: Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.45),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white70, width: 1.5),
                ),
                child: const Icon(
                  LucideIcons.play,
                  size: 24,
                  color: Colors.white,
                ),
              ),
            ),
          Positioned(
            top: 12,
            left: 12,
            child: _GlassChip(
              icon: isVideo ? LucideIcons.film : LucideIcons.image,
              text: _badge,
            ),
          ),
          Positioned(
            left: 12,
            right: 12,
            bottom: 12,
            child: Row(
              children: [
                Expanded(
                  child: _GlassButton(
                    icon: LucideIcons.slidersHorizontal,
                    label: 'Retoucher',
                    onTap: onEdit,
                  ),
                ),
                const SizedBox(width: 8),
                _GlassButton(
                  icon: LucideIcons.repeat,
                  tooltip: 'Changer de média',
                  onTap: onChange,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _GlassChip extends StatelessWidget {
  const _GlassChip({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: Colors.white),
          const SizedBox(width: 6),
          Text(
            text,
            style: AppTheme.sansText(
              size: 12,
              weight: FontWeight.w600,
              color: Colors.white,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

class _GlassButton extends StatelessWidget {
  const _GlassButton({
    required this.icon,
    required this.onTap,
    this.label,
    this.tooltip,
  });

  final IconData icon;
  final String? label;
  final String? tooltip;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final child = Material(
      color: Colors.black.withValues(alpha: 0.55),
      shape: const StadiumBorder(),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: SizedBox(
          height: 42,
          width: label == null ? 42 : null,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 17, color: Colors.white),
              if (label != null) ...[
                const SizedBox(width: 8),
                Text(
                  label!,
                  style: AppTheme.sansText(
                    size: 14,
                    weight: FontWeight.w700,
                    color: Colors.white,
                    height: 1.2,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
    return tooltip == null ? child : Tooltip(message: tooltip!, child: child);
  }
}

/// Champ intégré à un groupe (icône + saisie sans bordure).
class _InlineField extends StatelessWidget {
  const _InlineField({
    required this.palette,
    required this.icon,
    required this.controller,
    required this.hint,
    this.maxLength,
    this.maxLines = 1,
    this.keyboard,
    this.capitalization = TextCapitalization.none,
  });

  final AccountPalette palette;
  final IconData icon;
  final TextEditingController controller;
  final String hint;
  final int? maxLength;
  final int maxLines;
  final TextInputType? keyboard;
  final TextCapitalization capitalization;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: p.iconBg,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 15, color: p.fg),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              controller: controller,
              maxLength: maxLength,
              minLines: 1,
              maxLines: maxLines,
              keyboardType: keyboard,
              autocorrect: keyboard != TextInputType.url,
              textCapitalization: capitalization,
              style: AppTheme.sansText(size: 15.5, color: p.fg, height: 1.35),
              decoration: InputDecoration(
                hintText: hint,
                hintStyle: AppTheme.sansText(size: 15.5, color: p.muted),
                filled: false,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 16),
                counterStyle: AppTheme.sansText(size: 11, color: p.muted),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Bouton principal collé en bas de l'écran.
class _BottomCta extends StatelessWidget {
  const _BottomCta({
    required this.palette,
    required this.label,
    required this.enabled,
    required this.onPressed,
    this.icon = LucideIcons.arrowRight,
  });

  final AccountPalette palette;
  final String label;
  final bool enabled;
  final VoidCallback onPressed;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: p.bg,
        border: Border(top: BorderSide(color: p.divider)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
        child: FilledButton(
          onPressed: enabled ? onPressed : null,
          style: FilledButton.styleFrom(
            backgroundColor: AppTheme.gold,
            foregroundColor: const Color(0xFF0B0B0B),
            disabledBackgroundColor: p.iconBg,
            disabledForegroundColor: p.muted,
            minimumSize: const Size.fromHeight(52),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                label,
                style: AppTheme.sansText(size: 16, weight: FontWeight.w700),
              ),
              const SizedBox(width: 8),
              Icon(icon, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}

/// Feuille « Changer de média ».
class _PickerSheet extends StatelessWidget {
  const _PickerSheet({required this.palette, required this.onPick});

  final AccountPalette palette;
  final _PickCallback onPick;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: p.muted.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Choisir un média',
              textAlign: TextAlign.center,
              style: AppTheme.displayText(
                size: 20,
                weight: FontWeight.w800,
                color: p.fg,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Vous pourrez le retoucher avant de continuer.',
              textAlign: TextAlign.center,
              style: AppTheme.sansText(size: 14, color: p.muted, height: 1.4),
            ),
            const SizedBox(height: 20),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 1.9,
              children: [
                for (final o in _pickOptions)
                  Material(
                    color: p.iconBg,
                    borderRadius: BorderRadius.circular(16),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () => onPick(o.$4, o.$5),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Icon(o.$1, size: 22, color: p.fg),
                            Text(
                              '${o.$2} · ${o.$3}',
                              style: AppTheme.sansText(
                                size: 14,
                                weight: FontWeight.w600,
                                color: p.fg,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
