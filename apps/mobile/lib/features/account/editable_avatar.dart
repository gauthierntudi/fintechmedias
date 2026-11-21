import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/api.dart';
import '../../core/constants.dart';
import '../../core/models.dart';
import '../../theme/app_theme.dart';
import '../editor/photo_editor.dart';

/// Limite imposée par l'API (`POST /auth/me/avatar`).
const _kMaxAvatarBytes = 1000000;

/// Avatar rond du compte, avec bouton caméra pour changer la photo
/// (galerie ou appareil photo → recadrage / retouche → envoi).
class EditableAvatar extends ConsumerStatefulWidget {
  const EditableAvatar({
    super.key,
    required this.user,
    this.size = 96,
    this.ringColor = AppTheme.gold,
  });

  final Subscriber user;
  final double size;
  final Color ringColor;

  @override
  ConsumerState<EditableAvatar> createState() => _EditableAvatarState();
}

class _EditableAvatarState extends ConsumerState<EditableAvatar> {
  File? _preview;
  double? _progress;
  bool get _busy => _progress != null;

  bool get _dark => Theme.of(context).brightness == Brightness.dark;

  void _toast(String message, {bool error = false}) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(
            message,
            style: error ? const TextStyle(color: Colors.white) : null,
          ),
          backgroundColor: error ? const Color(0xFFE5484D) : null,
        ),
      );
  }

  Future<void> _change() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      useRootNavigator: true,
      backgroundColor: _dark ? const Color(0xFF1C1C1E) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => const _SourceSheet(),
    );
    if (source == null || !mounted) return;

    try {
      final picked = await ImagePicker().pickImage(
        source: source,
        maxWidth: 2400,
        maxHeight: 2400,
        imageQuality: 95,
        preferredCameraDevice: CameraDevice.front,
      );
      if (picked == null || !mounted) return;

      final file = await openAvatarEditor(context, File(picked.path));
      if (file == null || !mounted) return;

      if (await file.length() > _kMaxAvatarBytes) {
        _toast('La photo dépasse 1 Mo, réessayez avec une autre image.',
            error: true);
        return;
      }
      await _upload(file);
    } catch (e) {
      if (!mounted) return;
      _toast('Impossible d’ouvrir la photo. Vérifiez les autorisations.',
          error: true);
    }
  }

  Future<void> _upload(File file) async {
    setState(() {
      _preview = file;
      _progress = 0;
    });
    try {
      final updated = await ref.read(apiClientProvider).uploadAvatar(
            file.path,
            onProgress: (p) {
              if (mounted) setState(() => _progress = p);
            },
          );
      ref.read(sessionProvider.notifier).setUser(updated);
      if (!mounted) return;
      _toast('Photo de profil mise à jour');
    } catch (e) {
      if (!mounted) return;
      setState(() => _preview = null);
      _toast(ref.read(apiClientProvider).apiError(e), error: true);
    } finally {
      if (mounted) setState(() => _progress = null);
    }
  }

  String get _initials {
    final u = widget.user;
    final parts =
        u.name.trim().split(RegExp(r'\s+')).where((e) => e.isNotEmpty).toList();
    if (parts.isEmpty) return u.email.isEmpty ? '?' : u.email[0].toUpperCase();
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final size = widget.size;
    final surface = _dark ? const Color(0xFF1C1C1E) : Colors.white;
    final fallback = Center(
      child: Text(
        _initials,
        style: AppTheme.displayText(
          size: size * 0.36,
          weight: FontWeight.w800,
          color: Colors.white,
        ),
      ),
    );
    final url = widget.user.avatarUrl;
    final Widget image = _preview != null
        ? Image.file(_preview!, fit: BoxFit.cover)
        : (url == null || url.isEmpty)
            ? fallback
            : CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.cover,
                placeholder: (_, _) => fallback,
                errorWidget: (_, _, _) => fallback,
              );
    final badge = (size * 0.34).clamp(26.0, 36.0);

    return Semantics(
      button: true,
      label: 'Changer la photo de profil',
      child: GestureDetector(
        onTap: _busy ? null : _change,
        child: SizedBox(
          width: size,
          height: size,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: size,
                height: size,
                padding: const EdgeInsets.all(2.5),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: widget.ringColor,
                ),
                child: Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(kBrandBlack),
                    border: Border.all(color: surface, width: 2.5),
                  ),
                  child: ClipOval(child: SizedBox.expand(child: image)),
                ),
              ),
              if (_busy)
                Positioned.fill(
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.45),
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: SizedBox(
                      width: size * 0.32,
                      height: size * 0.32,
                      child: CircularProgressIndicator(
                        value: (_progress ?? 0) > 0 ? _progress : null,
                        strokeWidth: 2.5,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              Positioned(
                right: -2,
                bottom: -2,
                child: Container(
                  width: badge,
                  height: badge,
                  decoration: BoxDecoration(
                    color: _dark ? Colors.white : const Color(kBrandBlack),
                    shape: BoxShape.circle,
                    border: Border.all(color: surface, width: 2.5),
                  ),
                  child: Icon(
                    LucideIcons.camera,
                    size: badge * 0.48,
                    color: _dark ? const Color(kBrandBlack) : Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SourceSheet extends StatelessWidget {
  const _SourceSheet();

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final fg = dark ? const Color(0xFFF2F4F7) : const Color(kBrandBlack);
    final muted = dark ? const Color(0xFF9AA3B2) : const Color(0xFF6B6B6B);
    final tile = dark ? const Color(0xFF2C2C2E) : const Color(0xFFF2F2F4);

    Widget option(IconData icon, String title, String subtitle,
        ImageSource source) {
      return Material(
        color: tile,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => Navigator.pop(context, source),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Icon(icon, size: 22, color: fg),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: AppTheme.sansText(
                          size: 16,
                          weight: FontWeight.w600,
                          color: fg,
                          height: 1.25,
                        ),
                      ),
                      Text(
                        subtitle,
                        style: AppTheme.sansText(
                          size: 13,
                          color: muted,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(LucideIcons.chevronRight, size: 18, color: muted),
              ],
            ),
          ),
        ),
      );
    }

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
                  color: muted.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Photo de profil',
              textAlign: TextAlign.center,
              style: AppTheme.displayText(
                size: 20,
                weight: FontWeight.w800,
                color: fg,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Vous pourrez la recadrer et la retoucher avant de l’enregistrer.',
              textAlign: TextAlign.center,
              style: AppTheme.sansText(size: 14, color: muted, height: 1.4),
            ),
            const SizedBox(height: 20),
            option(LucideIcons.image, 'Choisir dans la galerie',
                'Photos de l’appareil', ImageSource.gallery),
            const SizedBox(height: 10),
            option(LucideIcons.camera, 'Prendre une photo',
                'Utiliser l’appareil photo', ImageSource.camera),
          ],
        ),
      ),
    );
  }
}
