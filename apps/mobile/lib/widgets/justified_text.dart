import 'package:flutter/material.dart';

/// Justification : élargit les espaces entre mots (plafonnés),
/// sans étirer les lettres. Dernière ligne à gauche.
class JustifiedText extends StatelessWidget {
  const JustifiedText(
    this.text, {
    super.key,
    required this.style,
    this.textScaler,
    /// Surplus max par espace (fraction de la taille de police).
    this.maxExtraPerSpace = 0.32,
  });

  final String text;
  final TextStyle style;
  final TextScaler? textScaler;
  final double maxExtraPerSpace;

  @override
  Widget build(BuildContext context) {
    final scaler = textScaler ?? MediaQuery.textScalerOf(context);
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxWidth = constraints.maxWidth;
        if (!maxWidth.isFinite || maxWidth <= 0) {
          return Text(text, style: style, textScaler: scaler);
        }
        final lines = _breakLines(text, style, scaler, maxWidth);
        if (lines.isEmpty) return const SizedBox.shrink();
        final fontSize = style.fontSize ?? 16;
        final maxExtra = fontSize * maxExtraPerSpace;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < lines.length; i++)
              _SoftJustifiedLine(
                words: lines[i],
                style: style,
                textScaler: scaler,
                maxWidth: maxWidth,
                justify: i < lines.length - 1,
                maxExtraPerSpace: maxExtra,
              ),
          ],
        );
      },
    );
  }

  static List<List<String>> _breakLines(
    String text,
    TextStyle style,
    TextScaler scaler,
    double maxWidth,
  ) {
    final words = text
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim()
        .split(' ')
        .where((w) => w.isNotEmpty)
        .toList();
    if (words.isEmpty) return const [];

    final spaceW = _widthOf(' ', style, scaler);
    final lines = <List<String>>[];
    var current = <String>[words.first];
    var currentW = _widthOf(words.first, style, scaler);

    for (var i = 1; i < words.length; i++) {
      final w = _widthOf(words[i], style, scaler);
      final nextW = currentW + spaceW + w;
      if (nextW <= maxWidth) {
        current.add(words[i]);
        currentW = nextW;
      } else {
        lines.add(current);
        current = [words[i]];
        currentW = w;
      }
    }
    lines.add(current);
    return lines;
  }

  static double _widthOf(String text, TextStyle style, TextScaler scaler) {
    final painter = TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: TextDirection.ltr,
      textScaler: scaler,
      maxLines: 1,
    )..layout();
    return painter.width;
  }
}

class _SoftJustifiedLine extends StatelessWidget {
  const _SoftJustifiedLine({
    required this.words,
    required this.style,
    required this.textScaler,
    required this.maxWidth,
    required this.justify,
    required this.maxExtraPerSpace,
  });

  final List<String> words;
  final TextStyle style;
  final TextScaler textScaler;
  final double maxWidth;
  final bool justify;
  final double maxExtraPerSpace;

  @override
  Widget build(BuildContext context) {
    if (words.isEmpty) return const SizedBox.shrink();
    if (words.length == 1 || !justify) {
      return Text(
        words.join(' '),
        style: style,
        textScaler: textScaler,
        softWrap: false,
        overflow: TextOverflow.visible,
      );
    }

    final spaceW = JustifiedText._widthOf(' ', style, textScaler);
    var wordsW = 0.0;
    for (final w in words) {
      wordsW += JustifiedText._widthOf(w, style, textScaler);
    }
    final gaps = words.length - 1;
    final natural = wordsW + spaceW * gaps;
    final extra = maxWidth - natural;
    if (extra <= 0.5) {
      return Text(
        words.join(' '),
        style: style,
        textScaler: textScaler,
        softWrap: false,
        overflow: TextOverflow.visible,
      );
    }

    // Toujours justifier, mais plafond pour éviter les grands blancs.
    final perGap = (extra / gaps).clamp(0.0, maxExtraPerSpace);
    final gapW = spaceW + perGap;
    return Row(
      children: [
        for (var i = 0; i < words.length; i++) ...[
          Text(
            words[i],
            style: style,
            textScaler: textScaler,
            softWrap: false,
          ),
          if (i < gaps) SizedBox(width: gapW),
        ],
      ],
    );
  }
}
