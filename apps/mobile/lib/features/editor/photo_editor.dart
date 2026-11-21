import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:image/image.dart' as img;
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:pro_video_editor/pro_video_editor.dart' as pve;
import '../../theme/app_theme.dart';
import '../account/account_palette.dart';

part 'video_editor.dart';

/// Ouvre l'éditeur plein écran et renvoie le JPEG carré exporté (ou null).
Future<File?> openAvatarEditor(BuildContext context, File source) =>
    openPhotoEditor(context, source);

/// Éditeur photo générique : cadre rond (avatar) ou rectangulaire
/// ([aspect] = largeur / hauteur, ex. 9/16 pour un statut).
/// Renvoie un JPEG de [exportWidth] px de large (ou null si abandon).
Future<File?> openPhotoEditor(
  BuildContext context,
  File source, {
  double aspect = 1,
  bool round = true,
  double exportWidth = 1080,
  String discardMessage = 'La photo de profil ne sera pas modifiée.',
}) {
  return Navigator.of(context, rootNavigator: true).push<File>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => AvatarEditorScreen(
        source: source,
        aspect: aspect,
        round: round,
        exportWidth: exportWidth,
        discardMessage: discardMessage,
      ),
    ),
  );
}

const _accent = AppTheme.gold;

// ───────────────────────────── État d'édition ─────────────────────────────

enum _Filter { original, vif, noirBlanc, sepia, chaud, froid, mat }

extension on _Filter {
  String get label => switch (this) {
    _Filter.original => 'Original',
    _Filter.vif => 'Vif',
    _Filter.noirBlanc => 'N&B',
    _Filter.sepia => 'Sépia',
    _Filter.chaud => 'Chaud',
    _Filter.froid => 'Froid',
    _Filter.mat => 'Mat',
  };

  List<double> get matrix => switch (this) {
    _Filter.original => _Matrix.identity,
    _Filter.vif => _Matrix.mul(_Matrix.contrast(0.12), _Matrix.saturation(0.4)),
    _Filter.noirBlanc => _Matrix.mul(
      _Matrix.contrast(0.1),
      _Matrix.saturation(-1),
    ),
    _Filter.sepia => const [
      0.393, 0.769, 0.189, 0, 0, //
      0.349, 0.686, 0.168, 0, 0, //
      0.272, 0.534, 0.131, 0, 0, //
      0, 0, 0, 1, 0,
    ],
    _Filter.chaud => _Matrix.mul(_Matrix.warmth(0.6), _Matrix.saturation(0.1)),
    _Filter.froid => _Matrix.mul(
      _Matrix.warmth(-0.6),
      _Matrix.saturation(-0.05),
    ),
    _Filter.mat => _Matrix.mul(
      _Matrix.brightness(0.12),
      _Matrix.contrast(-0.22),
    ),
  };
}

@immutable
class _EditState {
  const _EditState({
    this.angle = 0,
    this.quarterTurns = 0,
    this.flipH = false,
    this.flipV = false,
    this.zoom = 1,
    this.pan = Offset.zero,
    this.brightness = 0,
    this.exposure = 0,
    this.contrast = 0,
    this.saturation = 0,
    this.warmth = 0,
    this.filter = _Filter.original,
  });

  /// Rotation fine en degrés (-45 … 45).
  final double angle;
  final int quarterTurns;
  final bool flipH;
  final bool flipV;
  final double zoom;

  /// Décalage en fraction du côté du cadre.
  final Offset pan;

  // Réglages, tous dans -1 … 1.
  final double brightness;
  final double exposure;
  final double contrast;
  final double saturation;
  final double warmth;
  final _Filter filter;

  _EditState copyWith({
    double? angle,
    int? quarterTurns,
    bool? flipH,
    bool? flipV,
    double? zoom,
    Offset? pan,
    double? brightness,
    double? exposure,
    double? contrast,
    double? saturation,
    double? warmth,
    _Filter? filter,
  }) {
    return _EditState(
      angle: angle ?? this.angle,
      quarterTurns: quarterTurns ?? this.quarterTurns,
      flipH: flipH ?? this.flipH,
      flipV: flipV ?? this.flipV,
      zoom: zoom ?? this.zoom,
      pan: pan ?? this.pan,
      brightness: brightness ?? this.brightness,
      exposure: exposure ?? this.exposure,
      contrast: contrast ?? this.contrast,
      saturation: saturation ?? this.saturation,
      warmth: warmth ?? this.warmth,
      filter: filter ?? this.filter,
    );
  }

  List<double> get colorMatrix {
    var m = filter.matrix;
    m = _Matrix.mul(_Matrix.exposure(exposure), m);
    m = _Matrix.mul(_Matrix.brightness(brightness), m);
    m = _Matrix.mul(_Matrix.contrast(contrast), m);
    m = _Matrix.mul(_Matrix.saturation(saturation), m);
    m = _Matrix.mul(_Matrix.warmth(warmth), m);
    return m;
  }

  double get radians => (quarterTurns * 90 + angle) * math.pi / 180;

  /// Agrandissement minimal pour que l'image pivotée couvre tout le cadre
  /// de proportions [aspect] (largeur / hauteur).
  double coverScale(double aspect) {
    final a = angle.abs() * math.pi / 180;
    final c = math.cos(a), s = math.sin(a);
    const w = 1.0;
    final h = 1 / aspect;
    // Après un quart de tour, la boîte de l'image est couchée.
    final odd = quarterTurns.isOdd;
    final bw = odd ? h : w, bh = odd ? w : h;
    return math.max((w * c + h * s) / bw, (w * s + h * c) / bh);
  }

  @override
  bool operator ==(Object other) =>
      other is _EditState &&
      other.angle == angle &&
      other.quarterTurns == quarterTurns &&
      other.flipH == flipH &&
      other.flipV == flipV &&
      other.zoom == zoom &&
      other.pan == pan &&
      other.brightness == brightness &&
      other.exposure == exposure &&
      other.contrast == contrast &&
      other.saturation == saturation &&
      other.warmth == warmth &&
      other.filter == filter;

  @override
  int get hashCode => Object.hash(
    angle,
    quarterTurns,
    flipH,
    flipV,
    zoom,
    pan,
    brightness,
    exposure,
    contrast,
    saturation,
    warmth,
    filter,
  );
}

/// Matrices couleur 5×4 (format `ColorFilter.matrix`, décalages en 0…255).
abstract final class _Matrix {
  static const identity = <double>[
    1, 0, 0, 0, 0, //
    0, 1, 0, 0, 0, //
    0, 0, 1, 0, 0, //
    0, 0, 0, 1, 0,
  ];

  /// `a ∘ b` : applique `b` puis `a`.
  static List<double> mul(List<double> a, List<double> b) {
    final out = List<double>.filled(20, 0);
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 5; c++) {
        var v = c == 4 ? a[r * 5 + 4] : 0.0;
        for (var k = 0; k < 4; k++) {
          v += a[r * 5 + k] * b[k * 5 + c];
        }
        out[r * 5 + c] = v;
      }
    }
    return out;
  }

  static List<double> brightness(double v) {
    final o = v * 70;
    return [1, 0, 0, 0, o, 0, 1, 0, 0, o, 0, 0, 1, 0, o, 0, 0, 0, 1, 0];
  }

  static List<double> exposure(double v) {
    final k = math.pow(2, v).toDouble();
    return [k, 0, 0, 0, 0, 0, k, 0, 0, 0, 0, 0, k, 0, 0, 0, 0, 0, 1, 0];
  }

  static List<double> contrast(double v) {
    final k = 1 + v * 0.8;
    final t = 128 * (1 - k);
    return [k, 0, 0, 0, t, 0, k, 0, 0, t, 0, 0, k, 0, t, 0, 0, 0, 1, 0];
  }

  static List<double> saturation(double v) {
    final s = 1 + v;
    const lr = 0.2126, lg = 0.7152, lb = 0.0722;
    final i = 1 - s;
    return [
      lr * i + s, lg * i, lb * i, 0, 0, //
      lr * i, lg * i + s, lb * i, 0, 0, //
      lr * i, lg * i, lb * i + s, 0, 0, //
      0, 0, 0, 1, 0,
    ];
  }

  static List<double> warmth(double v) {
    final o = v * 28;
    return [1, 0, 0, 0, o, 0, 1, 0, 0, o * 0.35, 0, 0, 1, 0, -o, 0, 0, 0, 1, 0];
  }
}

// ───────────────────────────── Écran ─────────────────────────────

enum _Tool { filtres, recadrer, lumiere, contraste, couleur }

extension on _Tool {
  String get label => switch (this) {
    _Tool.filtres => 'Filtres',
    _Tool.recadrer => 'Rotation',
    _Tool.lumiere => 'Lumière',
    _Tool.contraste => 'Contraste',
    _Tool.couleur => 'Couleur',
  };

  IconData get icon => switch (this) {
    _Tool.filtres => LucideIcons.sparkles,
    _Tool.recadrer => LucideIcons.rotateCwSquare,
    _Tool.lumiere => LucideIcons.sun,
    _Tool.contraste => LucideIcons.contrast,
    _Tool.couleur => LucideIcons.droplet,
  };
}

/// Réglage fin d'un outil (curseur -100 … 100).
enum _Adjust { luminosite, exposition, contraste, saturation, chaleur }

extension on _Adjust {
  String get label => switch (this) {
    _Adjust.luminosite => 'Luminosité',
    _Adjust.exposition => 'Exposition',
    _Adjust.contraste => 'Contraste',
    _Adjust.saturation => 'Saturation',
    _Adjust.chaleur => 'Chaleur',
  };

  IconData get icon => switch (this) {
    _Adjust.luminosite => LucideIcons.sunMedium,
    _Adjust.exposition => LucideIcons.aperture,
    _Adjust.contraste => LucideIcons.contrast,
    _Adjust.saturation => LucideIcons.droplet,
    _Adjust.chaleur => LucideIcons.thermometer,
  };

  double read(_EditState s) => switch (this) {
    _Adjust.luminosite => s.brightness,
    _Adjust.exposition => s.exposure,
    _Adjust.contraste => s.contrast,
    _Adjust.saturation => s.saturation,
    _Adjust.chaleur => s.warmth,
  };

  _EditState write(_EditState s, double v) => switch (this) {
    _Adjust.luminosite => s.copyWith(brightness: v),
    _Adjust.exposition => s.copyWith(exposure: v),
    _Adjust.contraste => s.copyWith(contrast: v),
    _Adjust.saturation => s.copyWith(saturation: v),
    _Adjust.chaleur => s.copyWith(warmth: v),
  };
}

List<_Adjust> _adjustsOf(_Tool t) => switch (t) {
  _Tool.lumiere => const [_Adjust.luminosite, _Adjust.exposition],
  _Tool.contraste => const [_Adjust.contraste],
  _Tool.couleur => const [_Adjust.saturation, _Adjust.chaleur],
  _ => const [],
};

class AvatarEditorScreen extends StatefulWidget {
  const AvatarEditorScreen({
    super.key,
    required this.source,
    this.aspect = 1,
    this.round = true,
    this.exportWidth = 1080,
    this.discardMessage = 'La photo de profil ne sera pas modifiée.',
  });

  final File source;
  final double aspect;
  final bool round;
  final double exportWidth;
  final String discardMessage;

  @override
  State<AvatarEditorScreen> createState() => _AvatarEditorScreenState();
}

class _AvatarEditorScreenState extends State<AvatarEditorScreen> {
  final _boundaryKey = GlobalKey();
  final _history = <_EditState>[const _EditState()];
  var _index = 0;

  _Tool? _tool;
  _Adjust? _adjust;
  _EditState? _draft; // état en cours dans un outil ouvert
  _EditState? _gestureStart;
  bool _compare = false;
  bool _gesturing = false;
  bool _exporting = false;

  _EditState get _committed => _history[_index];
  _EditState get _state => _draft ?? _committed;
  bool get _canUndo => _draft == null && _index > 0;
  bool get _canRedo => _draft == null && _index < _history.length - 1;

  void _commit(_EditState s) {
    if (s == _committed) return;
    _history
      ..removeRange(_index + 1, _history.length)
      ..add(s);
    _index = _history.length - 1;
  }

  void _openTool(_Tool t) {
    HapticFeedback.selectionClick();
    setState(() {
      _tool = t;
      _draft = _committed;
      final adjusts = _adjustsOf(t);
      _adjust = adjusts.isEmpty ? null : adjusts.first;
    });
  }

  void _closeTool({required bool apply}) {
    setState(() {
      if (apply && _draft != null) _commit(_draft!);
      _draft = null;
      _tool = null;
      _adjust = null;
    });
  }

  void _update(_EditState s) => setState(() {
    if (_draft != null) {
      _draft = s;
    } else {
      _commit(s);
    }
  });

  // ── Gestes pincer / glisser ──

  void _onScaleStart(ScaleStartDetails d) {
    _gestureStart = _state;
    setState(() => _gesturing = true);
  }

  void _onScaleUpdate(ScaleUpdateDetails d, Size frame) {
    final start = _gestureStart;
    if (start == null) return;
    final zoom = (start.zoom * d.scale).clamp(1.0, 5.0);
    final limit = (zoom * start.coverScale(widget.aspect) - 1) / 2;
    final delta = Offset(
      d.focalPointDelta.dx / frame.width,
      d.focalPointDelta.dy / frame.height,
    );
    final pan = Offset(
      (_state.pan.dx + delta.dx).clamp(-limit, limit),
      (_state.pan.dy + delta.dy).clamp(-limit, limit),
    );
    setState(() {
      final next = _state.copyWith(zoom: zoom, pan: pan);
      if (_draft != null) {
        _draft = next;
      } else {
        _history[_index] = next; // fusionné, poussé à la fin du geste
      }
    });
  }

  void _onScaleEnd(ScaleEndDetails d) {
    final start = _gestureStart;
    _gestureStart = null;
    setState(() {
      _gesturing = false;
      if (_draft == null && start != null && start != _committed) {
        final end = _committed;
        _history[_index] = start;
        _commit(end);
      }
    });
  }

  // ── Export ──

  Future<void> _export() async {
    if (_exporting) return;
    if (_draft != null) _closeTool(apply: true);
    setState(() {
      _exporting = true;
      _compare = false;
    });
    try {
      await WidgetsBinding.instance.endOfFrame;
      final boundary =
          _boundaryKey.currentContext!.findRenderObject()!
              as RenderRepaintBoundary;
      final ratio = widget.exportWidth / boundary.size.width;
      final image = await boundary.toImage(pixelRatio: ratio);
      final data = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
      final w = image.width, h = image.height;
      image.dispose();
      final jpg = await compute(_encodeJpeg, (
        data!.buffer.asUint8List(),
        w,
        h,
      ));
      final file = File(
        '${Directory.systemTemp.path}/photo_${DateTime.now().millisecondsSinceEpoch}.jpg',
      );
      await file.writeAsBytes(jpg, flush: true);
      if (mounted) Navigator.of(context).pop(file);
    } catch (e) {
      if (!mounted) return;
      setState(() => _exporting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Impossible de préparer la photo')),
      );
    }
  }

  Future<void> _close() async {
    if (_index == 0 && _draft == null) {
      Navigator.of(context).pop();
      return;
    }
    final p = AccountPalette.of(context);
    final quit = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: p.group,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => _QuitSheet(palette: p, message: widget.discardMessage),
    );
    if (quit == true && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final p = AccountPalette.of(context);
    final state = _state;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _close();
      },
      child: Scaffold(
        backgroundColor: p.group,
        body: SafeArea(
          child: Column(
            children: [
              _TopBar(
                palette: p,
                canUndo: _canUndo,
                canRedo: _canRedo,
                exporting: _exporting,
                onClose: _close,
                onUndo: () => setState(() => _index--),
                onRedo: () => setState(() => _index++),
                onCompare: (v) => setState(() => _compare = v),
                onDone: _export,
              ),
              Expanded(
                child: ColoredBox(
                  color: p.bg,
                  child: LayoutBuilder(
                    builder: (context, c) {
                      final w = math.min(
                        c.maxWidth - 32,
                        (c.maxHeight - 32) * widget.aspect,
                      );
                      final frame = Size(w, w / widget.aspect);
                      return Center(
                        child: GestureDetector(
                          onScaleStart: _onScaleStart,
                          onScaleUpdate: (d) => _onScaleUpdate(d, frame),
                          onScaleEnd: _onScaleEnd,
                          onDoubleTap: () => _update(
                            state.copyWith(zoom: 1, pan: Offset.zero),
                          ),
                          child: SizedBox.fromSize(
                            size: frame,
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                RepaintBoundary(
                                  key: _boundaryKey,
                                  child: _Canvas(
                                    source: widget.source,
                                    state: state,
                                    aspect: widget.aspect,
                                    original: _compare,
                                  ),
                                ),
                                IgnorePointer(
                                  child: CustomPaint(
                                    painter: _MaskPainter(
                                      shade: p.bg.withValues(alpha: 0.72),
                                      round: widget.round,
                                      grid:
                                          _gesturing || _tool == _Tool.recadrer,
                                    ),
                                  ),
                                ),
                                if (_compare)
                                  Positioned(
                                    top: 10,
                                    left: 0,
                                    right: 0,
                                    child: Center(
                                      child: _Chip(text: 'Original'),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                switchInCurve: Curves.easeOutCubic,
                transitionBuilder: (child, a) => FadeTransition(
                  opacity: a,
                  child: SizeTransition(
                    sizeFactor: a,
                    alignment: Alignment.bottomCenter,
                    child: child,
                  ),
                ),
                child: _tool == null
                    ? _ToolBar(
                        key: const ValueKey('tools'),
                        palette: p,
                        state: _committed,
                        onTool: _openTool,
                      )
                    : _ToolPanel(
                        key: ValueKey(_tool),
                        palette: p,
                        tool: _tool!,
                        adjust: _adjust,
                        source: widget.source,
                        state: state,
                        onAdjust: (a) => setState(() => _adjust = a),
                        onChanged: _update,
                        onCancel: () => _closeTool(apply: false),
                        onApply: () => _closeTool(apply: true),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Uint8List _encodeJpeg((Uint8List, int, int) args) {
  final (bytes, w, h) = args;
  final image = img.Image.fromBytes(
    width: w,
    height: h,
    bytes: bytes.buffer,
    numChannels: 4,
    order: img.ChannelOrder.rgba,
  );
  return img.encodeJpg(image, quality: 88);
}

// ───────────────────────────── Rendu ─────────────────────────────

class _Canvas extends StatelessWidget {
  const _Canvas({
    required this.source,
    required this.state,
    required this.aspect,
    required this.original,
  });

  final File source;
  final _EditState state;
  final double aspect;
  final bool original;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) {
        final w = c.maxWidth, h = c.maxHeight;
        final scale = state.zoom * state.coverScale(aspect);
        Widget image = Image.file(
          source,
          fit: BoxFit.cover,
          width: w,
          height: h,
          cacheWidth: 1600,
          filterQuality: FilterQuality.high,
          gaplessPlayback: true,
        );
        if (!original) {
          image = ColorFiltered(
            colorFilter: ColorFilter.matrix(state.colorMatrix),
            child: image,
          );
        }
        return ClipRect(
          child: ColoredBox(
            color: Colors.black,
            child: Transform.translate(
              offset: Offset(state.pan.dx * w, state.pan.dy * h),
              child: Transform.rotate(
                angle: state.radians,
                child: Transform.scale(
                  scaleX: scale * (state.flipH ? -1 : 1),
                  scaleY: scale * (state.flipV ? -1 : 1),
                  child: image,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Assombrit l'extérieur du cercle (aperçu de l'avatar) ou borde le cadre
/// rectangulaire, et trace une grille.
class _MaskPainter extends CustomPainter {
  _MaskPainter({required this.shade, required this.grid, this.round = true});

  final Color shade;
  final bool grid;
  final bool round;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final circle = round
        ? (Path()..addOval(rect.deflate(1)))
        : (Path()..addRect(rect.deflate(0.75)));
    final outside = Path.combine(
      PathOperation.difference,
      Path()..addRect(rect),
      circle,
    );
    canvas.drawPath(outside, Paint()..color = shade);
    canvas.drawPath(
      circle,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..color = Colors.white.withValues(alpha: 0.9),
    );
    if (!grid) return;
    final line = Paint()
      ..strokeWidth = 1
      ..color = Colors.white.withValues(alpha: 0.55);
    for (var i = 1; i < 3; i++) {
      final x = size.width * i / 3, y = size.height * i / 3;
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), line);
      canvas.drawLine(Offset(0, y), Offset(size.width, y), line);
    }
  }

  @override
  bool shouldRepaint(_MaskPainter old) =>
      old.shade != shade || old.grid != grid || old.round != round;
}

// ───────────────────────────── Barres ─────────────────────────────

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.palette,
    required this.canUndo,
    required this.canRedo,
    required this.exporting,
    required this.onClose,
    required this.onUndo,
    required this.onRedo,
    required this.onCompare,
    required this.onDone,
  });

  final AccountPalette palette;
  final bool canUndo;
  final bool canRedo;
  final bool exporting;
  final VoidCallback onClose;
  final VoidCallback onUndo;
  final VoidCallback onRedo;
  final ValueChanged<bool> onCompare;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    Widget icon(IconData i, VoidCallback? onTap, String tip) => IconButton(
      onPressed: onTap,
      tooltip: tip,
      icon: Icon(i, size: 21),
      color: p.fg,
      disabledColor: p.muted.withValues(alpha: 0.45),
    );
    return SizedBox(
      height: 56,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6),
        child: Row(
          children: [
            icon(LucideIcons.x, exporting ? null : onClose, 'Fermer'),
            const Spacer(),
            icon(LucideIcons.undo2, canUndo ? onUndo : null, 'Annuler'),
            icon(LucideIcons.redo2, canRedo ? onRedo : null, 'Rétablir'),
            // Maintenir pour comparer avec la photo d'origine.
            Tooltip(
              message: 'Maintenir pour comparer',
              child: GestureDetector(
                onTapDown: (_) => onCompare(true),
                onTapUp: (_) => onCompare(false),
                onTapCancel: () => onCompare(false),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Icon(LucideIcons.columns2, size: 21, color: p.fg),
                ),
              ),
            ),
            const Spacer(),
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: SizedBox(
                height: 36,
                child: FilledButton(
                  onPressed: exporting ? null : onDone,
                  style: FilledButton.styleFrom(
                    backgroundColor: _accent,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: _accent.withValues(alpha: 0.5),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    shape: const StadiumBorder(),
                  ),
                  child: exporting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          'Valider',
                          style: AppTheme.sansText(
                            size: 15,
                            weight: FontWeight.w700,
                            height: 1.2,
                            color: Colors.white,
                          ),
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Barre principale : une pastille par outil (point vert si modifié).
class _ToolBar extends StatelessWidget {
  const _ToolBar({
    super.key,
    required this.palette,
    required this.state,
    required this.onTool,
  });

  final AccountPalette palette;
  final _EditState state;
  final ValueChanged<_Tool> onTool;

  bool _edited(_Tool t) => switch (t) {
    _Tool.filtres => state.filter != _Filter.original,
    _Tool.recadrer =>
      state.angle != 0 ||
          state.quarterTurns % 4 != 0 ||
          state.flipH ||
          state.flipV,
    _ => _adjustsOf(t).any((a) => a.read(state) != 0),
  };

  @override
  Widget build(BuildContext context) {
    final p = palette;
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 18, 8, 14),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              for (final t in _Tool.values)
                _RoundTool(
                  palette: p,
                  icon: t.icon,
                  label: t.label,
                  dot: _edited(t),
                  onTap: () => onTool(t),
                ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            'Pincez pour zoomer · glissez pour cadrer',
            style: AppTheme.sansText(size: 12, color: p.muted, height: 1.2),
          ),
        ],
      ),
    );
  }
}

class _RoundTool extends StatelessWidget {
  const _RoundTool({
    required this.palette,
    required this.icon,
    required this.label,
    required this.onTap,
    this.selected = false,
    this.dot = false,
  });

  final AccountPalette palette;
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool selected;
  final bool dot;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: SizedBox(
          width: 66,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.visible,
                softWrap: false,
                style: AppTheme.sansText(
                  size: 12,
                  weight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected ? p.fg : p.muted,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 10),
              Stack(
                clipBehavior: Clip.none,
                children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: selected ? _accent : p.iconBg,
                    ),
                    child: Icon(
                      icon,
                      size: 20,
                      color: selected ? Colors.white : p.fg,
                    ),
                  ),
                  if (dot && !selected)
                    Positioned(
                      right: 1,
                      top: 1,
                      child: Container(
                        width: 9,
                        height: 9,
                        decoration: BoxDecoration(
                          color: _accent,
                          shape: BoxShape.circle,
                          border: Border.all(color: p.group, width: 1.5),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Panneau d'un outil ouvert : contrôles + barre ✕ / titre / ✓.
class _ToolPanel extends StatelessWidget {
  const _ToolPanel({
    super.key,
    required this.palette,
    required this.tool,
    required this.adjust,
    required this.source,
    required this.state,
    required this.onAdjust,
    required this.onChanged,
    required this.onCancel,
    required this.onApply,
  });

  final AccountPalette palette;
  final _Tool tool;
  final _Adjust? adjust;
  final File source;
  final _EditState state;
  final ValueChanged<_Adjust> onAdjust;
  final ValueChanged<_EditState> onChanged;
  final VoidCallback onCancel;
  final VoidCallback onApply;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    final Widget body = switch (tool) {
      _Tool.recadrer => _RotatePanel(
        palette: p,
        state: state,
        onChanged: onChanged,
      ),
      _Tool.filtres => _FilterPanel(
        palette: p,
        source: source,
        state: state,
        onChanged: onChanged,
      ),
      _ => _AdjustPanel(
        palette: p,
        adjusts: _adjustsOf(tool),
        current: adjust!,
        state: state,
        onAdjust: onAdjust,
        onChanged: onChanged,
      ),
    };
    return _PanelFrame(
      palette: p,
      title: tool.label,
      onCancel: onCancel,
      onApply: onApply,
      child: body,
    );
  }
}

/// Corps d'un outil + barre ✕ / titre / ✓.
class _PanelFrame extends StatelessWidget {
  const _PanelFrame({
    super.key,
    required this.palette,
    required this.title,
    required this.onCancel,
    required this.onApply,
    required this.child,
  });

  final AccountPalette palette;
  final String title;
  final VoidCallback onCancel;
  final VoidCallback onApply;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        child,
        Divider(height: 1, thickness: 1, color: p.divider),
        SizedBox(
          height: 56,
          child: Row(
            children: [
              IconButton(
                onPressed: onCancel,
                tooltip: 'Annuler',
                icon: Icon(LucideIcons.x, size: 22, color: p.fg),
              ),
              Expanded(
                child: Text(
                  title,
                  textAlign: TextAlign.center,
                  style: AppTheme.sansText(
                    size: 16,
                    weight: FontWeight.w700,
                    color: p.fg,
                    height: 1.2,
                  ),
                ),
              ),
              IconButton(
                onPressed: onApply,
                tooltip: 'Appliquer',
                icon: const Icon(LucideIcons.check, size: 22, color: _accent),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _RotatePanel extends StatelessWidget {
  const _RotatePanel({
    required this.palette,
    required this.state,
    required this.onChanged,
    this.fineAngle = true,
  });

  final AccountPalette palette;
  final _EditState state;
  final ValueChanged<_EditState> onChanged;

  /// Règle d'angle libre (photo) ; la vidéo ne pivote que par quarts de tour.
  final bool fineAngle;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    Widget square(IconData icon, String tip, bool active, VoidCallback onTap) {
      return IconButton(
        onPressed: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        tooltip: tip,
        style: IconButton.styleFrom(
          backgroundColor: active
              ? _accent.withValues(alpha: 0.15)
              : Colors.transparent,
        ),
        icon: Icon(icon, size: 21, color: active ? _accent : p.fg),
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 10, 10, 12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              square(
                LucideIcons.flipHorizontal2,
                'Miroir horizontal',
                state.flipH,
                () => onChanged(state.copyWith(flipH: !state.flipH)),
              ),
              square(
                LucideIcons.flipVertical2,
                'Miroir vertical',
                state.flipV,
                () => onChanged(state.copyWith(flipV: !state.flipV)),
              ),
              const Spacer(),
              TextButton(
                onPressed: () => onChanged(
                  state.copyWith(
                    angle: 0,
                    quarterTurns: 0,
                    flipH: false,
                    flipV: false,
                    zoom: 1,
                    pan: Offset.zero,
                  ),
                ),
                style: TextButton.styleFrom(foregroundColor: p.muted),
                child: const Text('Réinitialiser'),
              ),
              square(
                LucideIcons.rotateCwSquare,
                'Pivoter de 90°',
                false,
                () => onChanged(
                  state.copyWith(quarterTurns: (state.quarterTurns + 1) % 4),
                ),
              ),
            ],
          ),
          if (fineAngle) ...[
            const SizedBox(height: 6),
            _AngleRuler(
              palette: p,
              value: state.angle,
              onChanged: (v) => onChanged(state.copyWith(angle: v)),
            ),
          ],
        ],
      ),
    );
  }
}

/// Règle graduée -45° … 45° qu'on fait glisser sous un repère fixe.
class _AngleRuler extends StatefulWidget {
  const _AngleRuler({
    required this.palette,
    required this.value,
    required this.onChanged,
  });

  final AccountPalette palette;
  final double value;
  final ValueChanged<double> onChanged;

  @override
  State<_AngleRuler> createState() => _AngleRulerState();
}

class _AngleRulerState extends State<_AngleRuler> {
  static const _spacing = 9.0; // pixels par degré

  void _drag(DragUpdateDetails d) {
    final before = widget.value;
    final next = (before - d.delta.dx / _spacing).clamp(-45.0, 45.0);
    final snapped = next.abs() < 0.4 ? 0.0 : next;
    if (before.round() != snapped.round()) HapticFeedback.selectionClick();
    widget.onChanged(snapped);
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.palette;
    final label = '${widget.value.round()}°';
    return Semantics(
      slider: true,
      label: 'Inclinaison',
      value: label,
      child: GestureDetector(
        onHorizontalDragUpdate: _drag,
        onDoubleTap: () => widget.onChanged(0),
        child: SizedBox(
          height: 64,
          width: double.infinity,
          child: Column(
            children: [
              Text(
                label,
                style: AppTheme.sansText(
                  size: 13,
                  weight: FontWeight.w700,
                  color: widget.value == 0 ? p.muted : _accent,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 6),
              Expanded(
                child: CustomPaint(
                  size: Size.infinite,
                  painter: _RulerPainter(
                    value: widget.value,
                    spacing: _spacing,
                    tick: p.muted,
                    strong: p.fg,
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

class _RulerPainter extends CustomPainter {
  _RulerPainter({
    required this.value,
    required this.spacing,
    required this.tick,
    required this.strong,
  });

  final double value;
  final double spacing;
  final Color tick;
  final Color strong;

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final paint = Paint()..strokeWidth = 1.2;
    for (var d = -45; d <= 45; d++) {
      final x = cx + (d - value) * spacing;
      if (x < -2 || x > size.width + 2) continue;
      final major = d % 15 == 0;
      final fade = 1 - ((x - cx).abs() / cx).clamp(0.0, 1.0) * 0.8;
      paint.color = (major ? strong : tick).withValues(alpha: fade);
      final h = major ? 16.0 : (d % 5 == 0 ? 11.0 : 7.0);
      canvas.drawLine(Offset(x, 2), Offset(x, 2 + h), paint);
    }
    // Repère central (triangle).
    final marker = Path()
      ..moveTo(cx, size.height - 12)
      ..lineTo(cx - 6, size.height - 2)
      ..lineTo(cx + 6, size.height - 2)
      ..close();
    canvas.drawPath(marker, Paint()..color = _accent);
    canvas.drawLine(
      Offset(cx, 0),
      Offset(cx, 22),
      Paint()
        ..color = _accent
        ..strokeWidth = 2,
    );
  }

  @override
  bool shouldRepaint(_RulerPainter old) =>
      old.value != value || old.tick != tick || old.strong != strong;
}

class _AdjustPanel extends StatelessWidget {
  const _AdjustPanel({
    required this.palette,
    required this.adjusts,
    required this.current,
    required this.state,
    required this.onAdjust,
    required this.onChanged,
  });

  final AccountPalette palette;
  final List<_Adjust> adjusts;
  final _Adjust current;
  final _EditState state;
  final ValueChanged<_Adjust> onAdjust;
  final ValueChanged<_EditState> onChanged;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    final value = current.read(state);
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _ValueSlider(
            palette: p,
            value: value,
            onChanged: (v) => onChanged(current.write(state, v)),
          ),
          if (adjusts.length > 1) ...[
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (final a in adjusts)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    child: _RoundTool(
                      palette: p,
                      icon: a.icon,
                      label: a.label,
                      selected: a == current,
                      dot: a.read(state) != 0,
                      onTap: () {
                        HapticFeedback.selectionClick();
                        onAdjust(a);
                      },
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// Curseur bipolaire -100 … 100 avec bulle de valeur (double-tap = 0).
class _ValueSlider extends StatelessWidget {
  const _ValueSlider({
    required this.palette,
    required this.value,
    required this.onChanged,
  });

  final AccountPalette palette;
  final double value;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    final shown = (value * 100).round();
    return GestureDetector(
      onDoubleTap: () => onChanged(0),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
            decoration: BoxDecoration(
              color: shown == 0 ? p.iconBg : _accent,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              shown > 0 ? '+$shown' : '$shown',
              style: AppTheme.sansText(
                size: 12,
                weight: FontWeight.w800,
                height: 1.2,
                color: shown == 0 ? p.muted : Colors.white,
              ),
            ),
          ),
          // Piste bipolaire dessinée à la main : remplissage depuis le centre.
          Stack(
            alignment: Alignment.center,
            children: [
              Positioned.fill(
                child: CustomPaint(
                  painter: _BipolarTrackPainter(
                    value: value,
                    inset: _sliderInset,
                    track: p.divider,
                    fill: _accent,
                    tick: p.muted,
                  ),
                ),
              ),
              SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  trackHeight: 2.5,
                  activeTrackColor: Colors.transparent,
                  inactiveTrackColor: Colors.transparent,
                  thumbColor: _accent,
                  overlayColor: _accent.withValues(alpha: 0.12),
                  overlayShape: const RoundSliderOverlayShape(
                    overlayRadius: _sliderInset,
                  ),
                  thumbShape: const RoundSliderThumbShape(
                    enabledThumbRadius: 9,
                  ),
                  trackShape: const RoundedRectSliderTrackShape(),
                  showValueIndicator: ShowValueIndicator.never,
                ),
                child: Slider(
                  value: value,
                  min: -1,
                  max: 1,
                  onChanged: (v) {
                    final snapped = v.abs() < 0.03 ? 0.0 : v;
                    if ((snapped * 100).round() == 0 && shown != 0) {
                      HapticFeedback.selectionClick();
                    }
                    onChanged(snapped);
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

const _sliderInset = 20.0;

class _BipolarTrackPainter extends CustomPainter {
  _BipolarTrackPainter({
    required this.value,
    required this.inset,
    required this.track,
    required this.fill,
    required this.tick,
  });

  final double value;
  final double inset;
  final Color track;
  final Color fill;
  final Color tick;

  @override
  void paint(Canvas canvas, Size size) {
    final y = size.height / 2;
    final left = inset, right = size.width - inset;
    final cx = (left + right) / 2;
    final x = cx + value * (right - left) / 2;
    final line = Paint()
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(Offset(left, y), Offset(right, y), line..color = track);
    canvas.drawLine(
      Offset(cx, y - 6),
      Offset(cx, y + 6),
      Paint()
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round
        ..color = tick,
    );
    if (value != 0) {
      canvas.drawLine(Offset(cx, y), Offset(x, y), line..color = fill);
    }
  }

  @override
  bool shouldRepaint(_BipolarTrackPainter old) =>
      old.value != value || old.track != track || old.fill != fill;
}

class _FilterPanel extends StatelessWidget {
  const _FilterPanel({
    required this.palette,
    required this.source,
    required this.state,
    required this.onChanged,
  });

  final AccountPalette palette;
  final File source;
  final _EditState state;
  final ValueChanged<_EditState> onChanged;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    return SizedBox(
      height: 118,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
        itemCount: _Filter.values.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (context, i) {
          final f = _Filter.values[i];
          final selected = f == state.filter;
          return GestureDetector(
            onTap: () {
              HapticFeedback.selectionClick();
              onChanged(state.copyWith(filter: f));
            },
            child: Column(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  width: 64,
                  height: 64,
                  padding: const EdgeInsets.all(2.5),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: selected ? _accent : Colors.transparent,
                      width: 2,
                    ),
                  ),
                  child: ClipOval(
                    child: ColorFiltered(
                      colorFilter: ColorFilter.matrix(f.matrix),
                      child: Image.file(
                        source,
                        fit: BoxFit.cover,
                        cacheWidth: 180,
                        gaplessPlayback: true,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  f.label,
                  style: AppTheme.sansText(
                    size: 12,
                    weight: selected ? FontWeight.w700 : FontWeight.w500,
                    color: selected ? p.fg : p.muted,
                    height: 1.2,
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        text,
        style: AppTheme.sansText(
          size: 12,
          weight: FontWeight.w700,
          color: Colors.white,
          height: 1.2,
        ),
      ),
    );
  }
}

class _QuitSheet extends StatelessWidget {
  const _QuitSheet({required this.palette, required this.message});

  final AccountPalette palette;
  final String message;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    ButtonStyle style(Color bg, Color fg) => FilledButton.styleFrom(
      backgroundColor: bg,
      foregroundColor: fg,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
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
              'Abandonner les retouches ?',
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
                style: style(const Color(0xFFE5484D), Colors.white),
                child: const Text('Abandonner'),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: 52,
              child: FilledButton(
                onPressed: () => Navigator.pop(context, false),
                style: style(p.iconBg, p.fg),
                child: const Text('Continuer les retouches'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
