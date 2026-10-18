import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/router.dart';
import 'features/splash/splash_view.dart';
import 'theme/app_theme.dart';
import 'widgets/now_playing_overlay.dart';

class EntrevueApp extends ConsumerStatefulWidget {
  const EntrevueApp({super.key, this.showSplash = true});

  final bool showSplash;

  @override
  ConsumerState<EntrevueApp> createState() => _EntrevueAppState();
}

class _EntrevueAppState extends ConsumerState<EntrevueApp> {
  late bool _splash = widget.showSplash;

  @override
  void initState() {
    super.initState();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setPreferredOrientations(const [
      DeviceOrientation.portraitUp,
    ]);
    if (!widget.showSplash) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        FlutterNativeSplash.remove();
      });
      return;
    }
    // 1) Laisser peindre SplashView (même logo que le natif)
    // 2) Retirer le splash natif dessous — plus de flash d’un autre logo
    // 3) Garder SplashView un court instant, puis entrer dans l’app
    WidgetsBinding.instance.addPostFrameCallback((_) {
      FlutterNativeSplash.remove();
      Future<void>.delayed(const Duration(milliseconds: 900), _hideSplash);
    });
    // Filet si le 1er frame est retardé (debug iOS).
    Future<void>.delayed(const Duration(milliseconds: 2200), _hideSplash);
  }

  void _hideSplash() {
    if (!mounted || !_splash) return;
    setState(() => _splash = false);
    FlutterNativeSplash.remove();
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'Fintech Médias',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ThemeMode.system,
      routerConfig: router,
      builder: (context, child) {
        final overlay = AppTheme.statusBarForMode(
          Theme.of(context).brightness,
        );
        return AnnotatedRegion<SystemUiOverlayStyle>(
          value: overlay,
          child: NowPlayingOverlayHost(
            child: Stack(
              fit: StackFit.expand,
              children: [
                child ?? const SizedBox.shrink(),
                IgnorePointer(
                  ignoring: !_splash,
                  child: AnimatedOpacity(
                    opacity: _splash ? 1 : 0,
                    duration: MediaQuery.of(context).disableAnimations
                        ? Duration.zero
                        : const Duration(milliseconds: 280),
                    child: const SplashView(),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
