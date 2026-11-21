import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/api.dart';
import '../../core/google_auth.dart';
import '../../core/models.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_shell.dart';
import '../../widgets/google_sign_in_button.dart';
import '../../widgets/masonry_backdrop.dart';
import '../../widgets/studrc_logo.dart';

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider);
    if (user == null) {
      return const Scaffold(body: _SignedOut());
    }
    return Scaffold(
      appBar: AppBar(
        title: const FintechLogo(height: 26),
        centerTitle: true,
      ),
      body: _SignedIn(user: user),
    );
  }
}

class _SignedOut extends ConsumerStatefulWidget {
  const _SignedOut();

  @override
  ConsumerState<_SignedOut> createState() => _SignedOutState();
}

class _SignedOutState extends ConsumerState<_SignedOut> {
  var _busy = false;
  String? _error;

  Future<void> _submitGoogle() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final settings = ref.read(appSettingsProvider).valueOrNull;
      final credential = await GoogleAuth.idToken(settings);
      if (!mounted) return;
      await ref.read(sessionProvider.notifier).loginWithGoogle(credential);
    } on GoogleSignInCanceled {
      return;
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = ref.read(apiClientProvider).apiError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const ink = Colors.white;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: AppTheme.statusBarLightIcons,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const MasonryBackdrop(backgroundColor: Color(0xFF111111)),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0x66111111),
                  Color(0xCC111111),
                  Color(0xF8111111),
                ],
                stops: [0, 0.45, 1],
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
              child: Column(
                children: [
                  const FintechLogo(height: 34, onDark: true),
                  const Spacer(),
                  Text(
                    'Votre espace Fintech Médias',
                    textAlign: TextAlign.center,
                    style: AppTheme.displayText(
                      size: 24,
                      weight: FontWeight.w800,
                      color: ink,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Connectez-vous pour vos achats, notifications et la lecture des magazines.',
                    textAlign: TextAlign.center,
                    style: AppTheme.sansText(
                      size: 15,
                      height: 1.45,
                      color: ink.withValues(alpha: 0.78),
                    ),
                  ),
                  const SizedBox(height: 28),
                  AuthPrimaryButton(
                    label: 'Se connecter',
                    borderRadius: 0,
                    busy: _busy,
                    onPressed: _busy ? null : () => context.push('/connexion'),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: OutlinedButton(
                      onPressed:
                          _busy ? null : () => context.push('/inscription'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: ink,
                        side: BorderSide(color: ink.withValues(alpha: 0.45)),
                        shape: const RoundedRectangleBorder(
                          borderRadius: BorderRadius.zero,
                        ),
                      ),
                      child: Text(
                        'Créer un compte',
                        style: AppTheme.sansText(
                          size: 16,
                          weight: FontWeight.w700,
                          color: ink,
                        ),
                      ),
                    ),
                  ),
                  Theme(
                    data: Theme.of(context).copyWith(
                      colorScheme: Theme.of(context).colorScheme.copyWith(
                        surface: Colors.white,
                        onSurface: AppTheme.navy,
                        outline: Colors.white,
                      ),
                    ),
                    child: GoogleSignInButton(
                      busy: _busy,
                      borderRadius: 0,
                      dividerLabel: 'Ou',
                      onPressed: _submitGoogle,
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 14),
                    AuthErrorBanner(_error!),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SignedIn extends ConsumerWidget {
  const _SignedIn({required this.user});

  final Subscriber user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListView(
      children: [
        ListTile(
          leading: CircleAvatar(
            backgroundImage: user.avatarUrl != null
                ? NetworkImage(user.avatarUrl!)
                : null,
            child: user.avatarUrl == null
                ? Text(user.name.isEmpty ? '?' : user.name[0].toUpperCase())
                : null,
          ),
          title: Text(user.name),
          subtitle: Text(user.email),
        ),
        const Divider(),
        ListTile(
          leading: const Icon(LucideIcons.userRound),
          title: const Text('Profil'),
          onTap: () => context.push('/profil'),
        ),
        ListTile(
          leading: const Icon(LucideIcons.bell),
          title: const Text('Notifications'),
          onTap: () => context.push('/notifications'),
        ),
        ListTile(
          leading: const Icon(LucideIcons.shoppingBag),
          title: const Text('Mes achats'),
          onTap: () => context.push('/achats'),
        ),
        ListTile(
          leading: const Icon(LucideIcons.logOut),
          title: const Text('Se déconnecter'),
          onTap: () => ref.read(sessionProvider.notifier).logout(),
        ),
      ],
    );
  }
}
