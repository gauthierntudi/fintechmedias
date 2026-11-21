import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Photos onboarding — collage masonry 3 colonnes.
const kMasonryImages = <String>[
  'assets/onboarding/01.jpg',
  'assets/onboarding/02.jpg',
  'assets/onboarding/03.jpg',
  'assets/onboarding/04.jpg',
  'assets/onboarding/05.jpg',
  'assets/onboarding/06.jpg',
  'assets/onboarding/07.jpg',
  'assets/onboarding/08.jpg',
  'assets/onboarding/09.jpg',
  'assets/onboarding/010.jpg',
  'assets/onboarding/011.jpg',
  'assets/onboarding/012.jpeg',
  'assets/onboarding/013.jpg',
  'assets/onboarding/014.jpg',
  'assets/onboarding/015.jpg',
  'assets/onboarding/016.jpg',
  'assets/onboarding/017.jpg',
  'assets/onboarding/018.jpg',
  'assets/onboarding/019.jpg',
  'assets/onboarding/020.jpg',
];

/// Masonry animé 3 colonnes : monte / descend / monte.
class MasonryBackdrop extends StatefulWidget {
  const MasonryBackdrop({
    super.key,
    this.backgroundColor = const Color(0xFF111111),
  });

  final Color backgroundColor;

  @override
  State<MasonryBackdrop> createState() => _MasonryBackdropState();
}

class _MasonryBackdropState extends State<MasonryBackdrop> {
  final _col1 = ScrollController();
  final _col2 = ScrollController();
  final _col3 = ScrollController();
  Timer? _loop;
  var _primedDown = false;

  static const _tileH = <double>[200, 260, 180, 240, 220, 280];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  void _start() {
    if (!mounted) return;
    if (MediaQuery.of(context).disableAnimations) return;
    _loop?.cancel();
    _loop = Timer.periodic(const Duration(milliseconds: 16), (_) {
      if (!mounted) return;
      if (!_primedDown && _col2.hasClients) {
        final max = _col2.position.maxScrollExtent;
        if (max > 0) {
          _col2.jumpTo(max * 0.45);
          _primedDown = true;
        }
      }
      _nudge(_col1, 0.52);
      _nudge(_col2, -0.64);
      _nudge(_col3, 0.58);
    });
  }

  void _nudge(ScrollController c, double delta) {
    if (!c.hasClients) return;
    final max = c.position.maxScrollExtent;
    if (max <= 0) return;
    var next = c.offset + delta;
    if (next >= max) {
      next = 0;
    } else if (next <= 0) {
      next = max;
    }
    c.jumpTo(next);
  }

  @override
  void dispose() {
    _loop?.cancel();
    _col1.dispose();
    _col2.dispose();
    _col3.dispose();
    super.dispose();
  }

  List<String> _column(int shift) {
    final base = [...kMasonryImages, ...kMasonryImages, ...kMasonryImages];
    if (shift == 0) return base;
    final n = shift % base.length;
    return [...base.skip(n), ...base.take(n)];
  }

  @override
  Widget build(BuildContext context) {
    final a = _column(0);
    final b = _column(7);
    final c = _column(13);

    return ColoredBox(
      color: widget.backgroundColor,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: _MasonryColumn(
              controller: _col1,
              images: a,
              heights: _tileH,
              padLeft: 8,
              padRight: 4,
            ),
          ),
          Expanded(
            child: _MasonryColumn(
              controller: _col2,
              images: b,
              heights: const [240, 180, 270, 200, 250, 190],
              padLeft: 4,
              padRight: 4,
              startOffset: 36,
            ),
          ),
          Expanded(
            child: _MasonryColumn(
              controller: _col3,
              images: c,
              heights: const [190, 250, 210, 280, 170, 230],
              padLeft: 4,
              padRight: 8,
              startOffset: 18,
            ),
          ),
        ],
      ),
    );
  }
}

class _MasonryColumn extends StatelessWidget {
  const _MasonryColumn({
    required this.controller,
    required this.images,
    required this.heights,
    required this.padLeft,
    required this.padRight,
    this.startOffset = 0,
  });

  final ScrollController controller;
  final List<String> images;
  final List<double> heights;
  final double padLeft;
  final double padRight;
  final double startOffset;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      controller: controller,
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(padLeft, startOffset, padRight, 24),
      itemCount: images.length,
      itemBuilder: (context, i) {
        final h = heights[i % heights.length];
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: SizedBox(
            height: h,
            width: double.infinity,
            child: Image.asset(
              images[i],
              fit: BoxFit.cover,
              alignment: Alignment(
                math.sin(i * 0.7) * 0.15,
                math.cos(i * 0.5) * 0.1,
              ),
            ),
          ),
        );
      },
    );
  }
}
