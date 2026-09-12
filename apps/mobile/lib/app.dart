import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
    if (!widget.showSplash) return;
    Future<void>.delayed(const Duration(milliseconds: 1100), () {
      if (mounted) setState(() => _splash = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'ENTREVUE',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ThemeMode.system,
      routerConfig: router,
      builder: (context, child) {
        return NowPlayingOverlayHost(
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
        );
      },
    );
  }
}
