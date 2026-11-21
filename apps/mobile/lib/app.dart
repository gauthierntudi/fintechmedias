import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/router.dart';
import 'theme/app_theme.dart';
import 'widgets/now_playing_overlay.dart';

class FintechApp extends ConsumerStatefulWidget {
  const FintechApp({super.key});

  @override
  ConsumerState<FintechApp> createState() => _FintechAppState();
}

class _FintechAppState extends ConsumerState<FintechApp> {
  var _splashRemoved = false;

  @override
  void initState() {
    super.initState();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setPreferredOrientations(const [
      DeviceOrientation.portraitUp,
    ]);

    // Retirer le splash natif dès le 1er frame — pas de 2e UI, pas de délai
    // (un délai laisse iOS / Flutter re-mesurer le logo → flash grand→petit).
    WidgetsBinding.instance.addPostFrameCallback((_) => _removeSplash());
    Future<void>.delayed(const Duration(seconds: 4), _removeSplash);
  }

  void _removeSplash() {
    if (_splashRemoved) return;
    _splashRemoved = true;
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
            child: child ?? const SizedBox.shrink(),
          ),
        );
      },
    );
  }
}
