import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/onboarding.dart';
import '../../theme/app_theme.dart';
import '../../widgets/masonry_backdrop.dart';

class _HeadlinePart {
  const _HeadlinePart(this.text, {this.accent = false});
  final String text;
  final bool accent;
}

class _OnboardingPage {
  const _OnboardingPage({
    required this.parts,
    this.image,
    this.masonry = false,
    this.alignment = Alignment.center,
  });

  final List<_HeadlinePart> parts;
  final String? image;
  final bool masonry;
  final Alignment alignment;
}

const _pages = <_OnboardingPage>[
  _OnboardingPage(
    image: 'assets/onboarding/03.jpg',
    alignment: Alignment(0, -0.08),
    parts: [
      _HeadlinePart('L’actu '),
      _HeadlinePart('finance', accent: true),
      _HeadlinePart('\n& innovation\nen Afrique.'),
    ],
  ),
  _OnboardingPage(
    image: 'assets/onboarding/05.jpg',
    alignment: Alignment(0.1, -0.05),
    parts: [
      _HeadlinePart('Commencer\nmaintenant pour\n'),
      _HeadlinePart('30 jours.', accent: true),
    ],
  ),
  _OnboardingPage(
    image: 'assets/onboarding/09.jpg',
    alignment: Alignment(0, -0.12),
    parts: [
      _HeadlinePart('Le magazine\n'),
      _HeadlinePart('fintech', accent: true),
      _HeadlinePart('\ndans votre poche.'),
    ],
  ),
  _OnboardingPage(
    masonry: true,
    parts: [
      _HeadlinePart('Explorez\n'),
      _HeadlinePart('Fintech Médias', accent: true),
      _HeadlinePart('.'),
    ],
  ),
];

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool get _last => _index == _pages.length - 1;

  Duration _duration(BuildContext context) {
    return MediaQuery.of(context).disableAnimations
        ? Duration.zero
        : const Duration(milliseconds: 280);
  }

  Future<void> _goTo(int index) async {
    await _controller.animateToPage(
      index,
      duration: _duration(context),
      curve: Curves.easeOutCubic,
    );
  }

  Future<void> _finish() async {
    await ref.read(onboardingProvider).complete();
  }

  @override
  Widget build(BuildContext context) {
    final padding = MediaQuery.paddingOf(context);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: AppTheme.statusBarLightIcons,
      child: Scaffold(
        backgroundColor: const Color(0xFF111111),
        body: Stack(
          fit: StackFit.expand,
          children: [
            PageView.builder(
              controller: _controller,
              itemCount: _pages.length,
              onPageChanged: (i) => setState(() => _index = i),
              itemBuilder: (context, i) {
                final page = _pages[i];
                if (page.masonry) {
                  return const MasonryBackdrop(backgroundColor: AppTheme.gold);
                }
                return _FullBleedPhoto(page: page);
              },
            ),
            if (!_last) const Positioned.fill(child: _EdgeScrims()),
            if (_last)
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                height: MediaQuery.sizeOf(context).height * 0.70,
                child: const IgnorePointer(child: _LastSlideGreenScrim()),
              ),
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                  child: SizedBox(
                    height: 40,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        _ProgressBars(count: _pages.length, index: _index),
                        Align(
                          alignment: Alignment.centerRight,
                          child: _SkipChip(onPressed: _finish),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: _BottomChrome(
                page: _pages[_index],
                last: _last,
                bottomInset: padding.bottom,
                onNext: () => _last ? _finish() : _goTo(_index + 1),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FullBleedPhoto extends StatelessWidget {
  const _FullBleedPhoto({required this.page});

  final _OnboardingPage page;

  @override
  Widget build(BuildContext context) {
    return SizedBox.expand(
      child: Image.asset(
        page.image!,
        fit: BoxFit.cover,
        alignment: page.alignment,
        filterQuality: FilterQuality.high,
      ),
    );
  }
}

class _EdgeScrims extends StatelessWidget {
  const _EdgeScrims();

  @override
  Widget build(BuildContext context) {
    return const IgnorePointer(
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0x66111111),
              Color(0x00111111),
              Color(0x00111111),
              Color(0xCC111111),
              Color(0xF2111111),
            ],
            stops: [0, 0.22, 0.48, 0.72, 1],
          ),
        ),
      ),
    );
  }
}

/// Overlay vert charte depuis le bas, jusqu’à 70 % de l’écran.
class _LastSlideGreenScrim extends StatelessWidget {
  const _LastSlideGreenScrim();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.bottomCenter,
          end: Alignment.topCenter,
          colors: [
            AppTheme.gold,
            AppTheme.gold.withValues(alpha: 0.95),
            AppTheme.gold.withValues(alpha: 0.7),
            AppTheme.gold.withValues(alpha: 0.35),
            AppTheme.gold.withValues(alpha: 0),
          ],
          stops: const [0, 0.3, 0.55, 0.8, 1],
        ),
      ),
    );
  }
}

class _ProgressBars extends StatelessWidget {
  const _ProgressBars({required this.count, required this.index});

  final int count;
  final int index;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      label: 'Étape ${index + 1} sur $count',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(count, (i) {
          final active = i == index;
          return AnimatedContainer(
            duration: MediaQuery.of(context).disableAnimations
                ? Duration.zero
                : const Duration(milliseconds: 220),
            margin: EdgeInsets.only(right: i == count - 1 ? 0 : 6),
            width: active ? 28 : 18,
            height: 4,
            decoration: BoxDecoration(
              color: active
                  ? Colors.white
                  : Colors.white.withValues(alpha: 0.35),
              borderRadius: BorderRadius.circular(99),
            ),
          );
        }),
      ),
    );
  }
}

class _SkipChip extends StatelessWidget {
  const _SkipChip({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(99),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(99),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Text(
            'Ignorer',
            style: AppTheme.sansText(
              size: 13,
              weight: FontWeight.w700,
              color: const Color(0xFF111111),
            ),
          ),
        ),
      ),
    );
  }
}

class _BottomChrome extends StatelessWidget {
  const _BottomChrome({
    required this.page,
    required this.last,
    required this.bottomInset,
    required this.onNext,
  });

  final _OnboardingPage page;
  final bool last;
  final double bottomInset;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(24, 0, 24, 20 + bottomInset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AnimatedSwitcher(
            duration: MediaQuery.of(context).disableAnimations
                ? Duration.zero
                : const Duration(milliseconds: 220),
            child: Align(
              key: ValueKey(page.parts.map((p) => p.text).join()),
              alignment: Alignment.centerLeft,
              child: Text.rich(
                TextSpan(
                  children: [
                    for (final part in page.parts)
                      TextSpan(
                        text: part.text,
                        style: AppTheme.displayText(
                          size: 42,
                          weight: FontWeight.w800,
                          height: 1.08,
                          letterSpacing: -0.6,
                          color: last
                              ? (part.accent
                                    ? const Color(0xFF111111)
                                    : Colors.white)
                              : (part.accent ? AppTheme.gold : Colors.white),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 28),
          SizedBox(
            height: 56,
            child: FilledButton(
              onPressed: onNext,
              style: FilledButton.styleFrom(
                backgroundColor: last ? const Color(0xFF111111) : AppTheme.gold,
                foregroundColor: Colors.white,
                elevation: 0,
                textStyle: AppTheme.sansText(
                  size: 17,
                  weight: FontWeight.w800,
                  height: 1.2,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
              child: Text(last ? 'Commencer' : 'Suivant'),
            ),
          ),
        ],
      ),
    );
  }
}
