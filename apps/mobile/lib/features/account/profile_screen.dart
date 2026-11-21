import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/api.dart';
import '../../core/models.dart';
import '../../theme/app_theme.dart';
import 'account_palette.dart';
import 'editable_avatar.dart';

const _danger = Color(0xFFE5484D);
final _emailRe = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

/// Édition du profil : photo, identité, coordonnées et mot de passe.
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _email;
  late final TextEditingController _phone;
  late final TextEditingController _country;
  late final TextEditingController _address;
  late Map<TextEditingController, String> _initial;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final u = ref.read(sessionProvider);
    _name = TextEditingController(text: u?.name ?? '');
    _email = TextEditingController(text: u?.email ?? '');
    _phone = TextEditingController(text: u?.phone ?? '');
    _country = TextEditingController(text: u?.country ?? '');
    _address = TextEditingController(text: u?.address ?? '');
    _snapshot();
    for (final c in _initial.keys) {
      c.addListener(_onChanged);
    }
  }

  void _snapshot() {
    _initial = {
      for (final c in [_name, _email, _phone, _country, _address]) c: c.text,
    };
  }

  void _onChanged() => setState(() {});

  bool get _dirty =>
      _initial.entries.any((e) => e.key.text.trim() != e.value.trim());

  @override
  void dispose() {
    for (final c in _initial.keys) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save(Subscriber before) async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final email = _email.text.trim();
      final updated = await ref.read(apiClientProvider).updateProfile(
            name: _name.text.trim(),
            email: email,
            phone: _phone.text.trim(),
            country: _country.text.trim(),
            address: _address.text.trim(),
          );
      ref.read(sessionProvider.notifier).setUser(updated);
      if (!mounted) return;
      setState(_snapshot);
      final emailChanged = email.toLowerCase() != before.email.toLowerCase();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            emailChanged
                ? 'Profil enregistré. Confirmez votre nouvelle adresse e-mail.'
                : 'Profil enregistré',
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        setState(() => _error = ref.read(apiClientProvider).apiError(e));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool> _confirmDiscard() async {
    final p = AccountPalette.of(context);
    final ok = await showModalBottomSheet<bool>(
      context: context,
      useRootNavigator: true,
      backgroundColor: p.group,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => _ConfirmSheet(
        palette: p,
        title: 'Abandonner les modifications ?',
        message: 'Les changements non enregistrés seront perdus.',
        confirm: 'Abandonner',
      ),
    );
    return ok == true;
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(sessionProvider);
    final p = AccountPalette.of(context);
    if (user == null) {
      return Scaffold(backgroundColor: p.bg, appBar: AppBar());
    }
    final locked = !user.emailVerified;

    return PopScope(
      canPop: !_dirty || _busy,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (await _confirmDiscard() && context.mounted) {
          _initial.forEach((c, v) => c.text = v);
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        backgroundColor: p.bg,
        appBar: AppBar(
          backgroundColor: p.bg,
          surfaceTintColor: Colors.transparent,
          title: const Text('Modifier le profil'),
        ),
        body: GestureDetector(
          onTap: () => FocusScope.of(context).unfocus(),
          child: Form(
            key: _formKey,
            autovalidateMode: AutovalidateMode.onUserInteraction,
            child: ListView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
              children: [
                Center(child: EditableAvatar(user: user, size: 104)),
                const SizedBox(height: 10),
                Text(
                  'Touchez la photo pour la changer',
                  textAlign: TextAlign.center,
                  style: AppTheme.sansText(size: 13, color: p.muted),
                ),
                if (locked) ...[
                  const SizedBox(height: 20),
                  _Banner(
                    palette: p,
                    icon: LucideIcons.mailWarning,
                    text:
                        'Confirmez votre adresse e-mail (lien reçu par mail) pour pouvoir modifier votre profil.',
                  ),
                ],
                const SizedBox(height: 24),
                _Section(
                  palette: p,
                  title: 'Identité',
                  children: [
                    _Field(
                      palette: p,
                      label: 'Nom complet',
                      controller: _name,
                      icon: LucideIcons.userRound,
                      enabled: !locked,
                      textCapitalization: TextCapitalization.words,
                      autofillHints: const [AutofillHints.name],
                      validator: (v) => (v ?? '').trim().length < 2
                          ? 'Au moins 2 caractères'
                          : null,
                    ),
                    _Field(
                      palette: p,
                      label: 'Adresse e-mail',
                      controller: _email,
                      icon: LucideIcons.mail,
                      enabled: !locked,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      helper: _email.text.trim().toLowerCase() !=
                              user.email.toLowerCase()
                          ? 'Un lien de confirmation sera envoyé à la nouvelle adresse.'
                          : null,
                      validator: (v) => _emailRe.hasMatch((v ?? '').trim())
                          ? null
                          : 'Adresse e-mail invalide',
                    ),
                  ],
                ),
                const SizedBox(height: 22),
                _Section(
                  palette: p,
                  title: 'Coordonnées',
                  children: [
                    _Field(
                      palette: p,
                      label: 'Téléphone',
                      hint: '+243 …',
                      controller: _phone,
                      icon: LucideIcons.phone,
                      enabled: !locked,
                      keyboardType: TextInputType.phone,
                      autofillHints: const [AutofillHints.telephoneNumber],
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(RegExp(r'[0-9+ ()-]')),
                        LengthLimitingTextInputFormatter(40),
                      ],
                    ),
                    _Field(
                      palette: p,
                      label: 'Pays',
                      hint: 'RD Congo',
                      controller: _country,
                      icon: LucideIcons.globe,
                      enabled: !locked,
                      textCapitalization: TextCapitalization.words,
                      autofillHints: const [AutofillHints.countryName],
                      inputFormatters: [LengthLimitingTextInputFormatter(120)],
                    ),
                    _Field(
                      palette: p,
                      label: 'Adresse',
                      hint: 'Ville, quartier, avenue…',
                      controller: _address,
                      icon: LucideIcons.mapPin,
                      enabled: !locked,
                      maxLines: 3,
                      textCapitalization: TextCapitalization.sentences,
                      autofillHints: const [AutofillHints.fullStreetAddress],
                      inputFormatters: [LengthLimitingTextInputFormatter(500)],
                    ),
                  ],
                ),
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  _Banner(
                    palette: p,
                    icon: LucideIcons.circleAlert,
                    text: _error!,
                    color: _danger,
                  ),
                ],
                const SizedBox(height: 22),
                SizedBox(
                  height: 52,
                  child: FilledButton(
                    onPressed:
                        (_dirty && !_busy && !locked) ? () => _save(user) : null,
                    style: FilledButton.styleFrom(
                      backgroundColor: p.fg,
                      foregroundColor: p.group,
                      disabledBackgroundColor: p.divider,
                      disabledForegroundColor: p.muted,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: _busy
                        ? SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.4,
                              color: p.group,
                            ),
                          )
                        : const Text('Enregistrer les modifications'),
                  ),
                ),
                const SizedBox(height: 28),
                _PasswordCard(palette: p, enabled: !locked),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.palette,
    required this.title,
    required this.children,
  });

  final AccountPalette palette;
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 10),
          child: Text(
            title.toUpperCase(),
            style: AppTheme.sansText(
              size: 12,
              weight: FontWeight.w700,
              color: palette.muted,
              letterSpacing: 0.9,
              height: 1.2,
            ),
          ),
        ),
        Container(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
          decoration: BoxDecoration(
            color: palette.group,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: children,
          ),
        ),
      ],
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.palette,
    required this.label,
    required this.controller,
    required this.icon,
    this.hint,
    this.helper,
    this.enabled = true,
    this.obscure = false,
    this.maxLines = 1,
    this.keyboardType,
    this.textCapitalization = TextCapitalization.none,
    this.autofillHints,
    this.inputFormatters,
    this.validator,
    this.suffix,
  });

  final AccountPalette palette;
  final String label;
  final TextEditingController controller;
  final IconData icon;
  final String? hint;
  final String? helper;
  final bool enabled;
  final bool obscure;
  final int maxLines;
  final TextInputType? keyboardType;
  final TextCapitalization textCapitalization;
  final Iterable<String>? autofillHints;
  final List<TextInputFormatter>? inputFormatters;
  final String? Function(String?)? validator;
  final Widget? suffix;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    OutlineInputBorder border(Color c, [double w = 1]) => OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: c, width: w),
        );
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 2, bottom: 6),
            child: Text(
              label,
              style: AppTheme.sansText(
                size: 13,
                weight: FontWeight.w600,
                color: p.fg,
                height: 1.2,
              ),
            ),
          ),
          TextFormField(
            controller: controller,
            enabled: enabled,
            obscureText: obscure,
            maxLines: obscure ? 1 : maxLines,
            minLines: 1,
            keyboardType:
                maxLines > 1 ? TextInputType.multiline : keyboardType,
            textCapitalization: textCapitalization,
            autofillHints: autofillHints,
            inputFormatters: inputFormatters,
            validator: validator,
            cursorColor: AppTheme.gold,
            style: AppTheme.sansText(size: 16, color: p.fg, height: 1.35),
            decoration: InputDecoration(
              isDense: true,
              filled: true,
              fillColor: p.iconBg,
              hintText: hint,
              hintStyle: AppTheme.sansText(size: 16, color: p.muted),
              helperText: helper,
              helperMaxLines: 2,
              helperStyle: AppTheme.sansText(size: 12, color: p.muted),
              errorStyle: AppTheme.sansText(size: 12, color: _danger),
              prefixIcon: Icon(icon, size: 19, color: p.muted),
              suffixIcon: suffix,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              border: border(Colors.transparent),
              enabledBorder: border(Colors.transparent),
              disabledBorder: border(Colors.transparent),
              focusedBorder: border(AppTheme.gold, 1.5),
              errorBorder: border(_danger),
              focusedErrorBorder: border(_danger, 1.5),
            ),
          ),
        ],
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({
    required this.palette,
    required this.icon,
    required this.text,
    this.color,
  });

  final AccountPalette palette;
  final IconData icon;
  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? const Color(0xFFD97706);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: c),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: AppTheme.sansText(
                size: 14,
                color: palette.fg,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Changement de mot de passe, replié par défaut.
class _PasswordCard extends ConsumerStatefulWidget {
  const _PasswordCard({required this.palette, required this.enabled});

  final AccountPalette palette;
  final bool enabled;

  @override
  ConsumerState<_PasswordCard> createState() => _PasswordCardState();
}

class _PasswordCardState extends ConsumerState<_PasswordCard> {
  final _key = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _open = false;
  bool _show = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_key.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(apiClientProvider).changePassword(
            currentPassword: _current.text,
            newPassword: _next.text,
          );
      if (!mounted) return;
      _current.clear();
      _next.clear();
      _confirm.clear();
      setState(() => _open = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Mot de passe modifié')),
      );
    } catch (e) {
      if (mounted) {
        setState(() => _error = ref.read(apiClientProvider).apiError(e));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.palette;
    final eye = IconButton(
      onPressed: () => setState(() => _show = !_show),
      icon: Icon(
        _show ? LucideIcons.eyeOff : LucideIcons.eye,
        size: 19,
        color: p.muted,
      ),
      tooltip: _show ? 'Masquer' : 'Afficher',
    );

    return Container(
      decoration: BoxDecoration(
        color: p.group,
        borderRadius: BorderRadius.circular(18),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: widget.enabled ? () => setState(() => _open = !_open) : null,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: p.iconBg,
                      borderRadius: BorderRadius.circular(11),
                    ),
                    child: Icon(LucideIcons.lockKeyhole, size: 19, color: p.fg),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Mot de passe',
                          style: AppTheme.sansText(
                            size: 16,
                            weight: FontWeight.w600,
                            color: p.fg,
                            height: 1.25,
                          ),
                        ),
                        Text(
                          'Modifier votre mot de passe',
                          style: AppTheme.sansText(
                            size: 13,
                            color: p.muted,
                            height: 1.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                  AnimatedRotation(
                    turns: _open ? 0.25 : 0,
                    duration: const Duration(milliseconds: 180),
                    child: Icon(
                      LucideIcons.chevronRight,
                      size: 18,
                      color: p.muted,
                    ),
                  ),
                ],
              ),
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
            alignment: Alignment.topCenter,
            child: !_open
                ? const SizedBox(width: double.infinity)
                : Padding(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                    child: Form(
                      key: _key,
                      autovalidateMode: AutovalidateMode.onUserInteraction,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _Field(
                            palette: p,
                            label: 'Mot de passe actuel',
                            controller: _current,
                            icon: LucideIcons.keyRound,
                            obscure: !_show,
                            suffix: eye,
                            autofillHints: const [AutofillHints.password],
                            validator: (v) =>
                                (v ?? '').isEmpty ? 'Obligatoire' : null,
                          ),
                          _Field(
                            palette: p,
                            label: 'Nouveau mot de passe',
                            helper: '8 caractères minimum',
                            controller: _next,
                            icon: LucideIcons.lock,
                            obscure: !_show,
                            autofillHints: const [AutofillHints.newPassword],
                            validator: (v) => (v ?? '').length < 8
                                ? '8 caractères minimum'
                                : null,
                          ),
                          _Field(
                            palette: p,
                            label: 'Confirmer le nouveau mot de passe',
                            controller: _confirm,
                            icon: LucideIcons.lock,
                            obscure: !_show,
                            autofillHints: const [AutofillHints.newPassword],
                            validator: (v) => v != _next.text
                                ? 'Les mots de passe ne correspondent pas'
                                : null,
                          ),
                          if (_error != null) ...[
                            _Banner(
                              palette: p,
                              icon: LucideIcons.circleAlert,
                              text: _error!,
                              color: _danger,
                            ),
                            const SizedBox(height: 12),
                          ],
                          SizedBox(
                            height: 48,
                            child: OutlinedButton(
                              onPressed: _busy ? null : _submit,
                              style: OutlinedButton.styleFrom(
                                foregroundColor: p.fg,
                                side: BorderSide(color: p.divider, width: 1.5),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                              child: _busy
                                  ? SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2.2,
                                        color: p.fg,
                                      ),
                                    )
                                  : const Text('Mettre à jour le mot de passe'),
                            ),
                          ),
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

class _ConfirmSheet extends StatelessWidget {
  const _ConfirmSheet({
    required this.palette,
    required this.title,
    required this.message,
    required this.confirm,
  });

  final AccountPalette palette;
  final String title;
  final String message;
  final String confirm;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    ButtonStyle style(Color bg, Color fg) => FilledButton.styleFrom(
          backgroundColor: bg,
          foregroundColor: fg,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        );
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
              title,
              textAlign: TextAlign.center,
              style: AppTheme.displayText(
                size: 21,
                weight: FontWeight.w800,
                color: p.fg,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTheme.sansText(size: 15, color: p.muted, height: 1.45),
            ),
            const SizedBox(height: 24),
            SizedBox(
              height: 52,
              child: FilledButton(
                onPressed: () => Navigator.pop(context, true),
                style: style(_danger, Colors.white),
                child: Text(confirm),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: 52,
              child: FilledButton(
                onPressed: () => Navigator.pop(context, false),
                style: style(p.iconBg, p.fg),
                child: const Text('Continuer l’édition'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
