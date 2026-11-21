part of 'photo_editor.dart';

/// Ouvre l'éditeur vidéo plein écran (coupe, filtres, rotation, réglages,
/// son) et renvoie la vidéo exportée en MP4, la source telle quelle si rien
/// n'a été modifié, ou null si l'utilisateur abandonne.
Future<File?> openVideoEditor(
  BuildContext context,
  File source, {
  Duration maxDuration = const Duration(seconds: 60),
}) {
  return Navigator.of(context, rootNavigator: true).push<File>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) =>
          VideoEditorScreen(source: source, maxDuration: maxDuration),
    ),
  );
}

enum _VTool { couper, filtres, rotation, reglages }

extension on _VTool {
  String get label => switch (this) {
    _VTool.couper => 'Couper',
    _VTool.filtres => 'Filtres',
    _VTool.rotation => 'Rotation',
    _VTool.reglages => 'Réglages',
  };

  IconData get icon => switch (this) {
    _VTool.couper => LucideIcons.scissors,
    _VTool.filtres => LucideIcons.sparkles,
    _VTool.rotation => LucideIcons.rotateCwSquare,
    _VTool.reglages => LucideIcons.slidersHorizontal,
  };
}

const _videoAdjusts = [
  _Adjust.luminosite,
  _Adjust.contraste,
  _Adjust.saturation,
  _Adjust.chaleur,
];

@immutable
class _VideoState {
  const _VideoState({
    this.look = const _EditState(),
    this.start = Duration.zero,
    this.end,
    this.muted = false,
  });

  final _EditState look;
  final Duration start;

  /// null tant que la durée n'est pas connue (= fin de la vidéo).
  final Duration? end;
  final bool muted;

  _VideoState copyWith({
    _EditState? look,
    Duration? start,
    Duration? end,
    bool? muted,
  }) {
    return _VideoState(
      look: look ?? this.look,
      start: start ?? this.start,
      end: end ?? this.end,
      muted: muted ?? this.muted,
    );
  }

  bool trimmed(Duration total) =>
      start > Duration.zero || (end != null && end! < total);

  bool get lookEdited => look != const _EditState();

  @override
  bool operator ==(Object other) =>
      other is _VideoState &&
      other.look == look &&
      other.start == start &&
      other.end == end &&
      other.muted == muted;

  @override
  int get hashCode => Object.hash(look, start, end, muted);
}

class VideoEditorScreen extends StatefulWidget {
  const VideoEditorScreen({
    super.key,
    required this.source,
    this.maxDuration = const Duration(seconds: 60),
  });

  final File source;
  final Duration maxDuration;

  @override
  State<VideoEditorScreen> createState() => _VideoEditorScreenState();
}

class _VideoEditorScreenState extends State<VideoEditorScreen> {
  late final Player _player = Player();
  late final VideoController _controller = VideoController(_player);
  StreamSubscription<Duration>? _positionSub;

  final _history = <_VideoState>[const _VideoState()];
  var _index = 0;
  _VTool? _tool;
  _Adjust _adjust = _videoAdjusts.first;
  _VideoState? _draft;
  bool _compare = false;

  Duration _total = Duration.zero;
  Size _size = const Size(9, 16);
  List<Uint8List> _thumbs = const [];
  File? _poster; // image de référence pour les miniatures de filtres
  String? _loadError;

  bool _exporting = false;
  double _progress = 0;
  String? _renderId;

  _VideoState get _committed => _history[_index];
  _VideoState get _state => _draft ?? _committed;
  bool get _canUndo => _draft == null && _index > 0;
  bool get _canRedo => _draft == null && _index < _history.length - 1;
  Duration get _end => _state.end ?? _total;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final video = pve.EditorVideo.file(widget.source);
    try {
      await _player.setPlaylistMode(PlaylistMode.single);
      await _player.open(Media(widget.source.path));
      _positionSub = _player.stream.position.listen(_loopInRange);

      final meta = await pve.ProVideoEditor.instance.getMetadata(video);
      if (!mounted) return;
      final total = meta.duration;
      final end = total > widget.maxDuration ? widget.maxDuration : total;
      setState(() {
        _total = total;
        _size = meta.resolution;
        _history[0] = _VideoState(end: end);
      });

      const count = 10;
      final step = total.inMicroseconds ~/ count;
      final thumbs = await pve.ProVideoEditor.instance.getThumbnails(
        pve.ThumbnailConfigs(
          video: video,
          outputSize: const Size(120, 200),
          timestamps: [
            for (var i = 0; i < count; i++)
              Duration(microseconds: step * i + step ~/ 2),
          ],
        ),
      );
      if (!mounted || thumbs.isEmpty) return;
      final poster = File(
        '${Directory.systemTemp.path}/poster_${DateTime.now().millisecondsSinceEpoch}.png',
      );
      await poster.writeAsBytes(thumbs[count ~/ 2.5]);
      if (!mounted) return;
      setState(() {
        _thumbs = thumbs;
        _poster = poster;
      });
    } catch (e) {
      if (mounted) setState(() => _loadError = 'Impossible de lire la vidéo.');
    }
  }

  /// Rejoue en boucle la portion conservée.
  void _loopInRange(Duration pos) {
    if (_total == Duration.zero) return;
    final s = _state;
    if (pos >= _end - const Duration(milliseconds: 80) || pos < s.start) {
      _player.seek(s.start);
    }
  }

  @override
  void dispose() {
    _positionSub?.cancel();
    _player.dispose();
    final id = _renderId;
    if (id != null && _exporting) pve.ProVideoEditor.instance.cancel(id);
    super.dispose();
  }

  // ── Historique / outils ──

  void _commit(_VideoState s) {
    if (s == _committed) return;
    _history
      ..removeRange(_index + 1, _history.length)
      ..add(s);
    _index = _history.length - 1;
  }

  void _openTool(_VTool t) {
    HapticFeedback.selectionClick();
    setState(() {
      _tool = t;
      _draft = _committed;
    });
  }

  void _closeTool({required bool apply}) {
    setState(() {
      if (apply && _draft != null) _commit(_draft!);
      _draft = null;
      _tool = null;
    });
    _player.seek(_state.start);
  }

  void _update(_VideoState s) {
    setState(() {
      if (_draft != null) {
        _draft = s;
      } else {
        _commit(s);
      }
    });
    _syncVolume();
  }

  /// L'aperçu reflète l'option « Muet ».
  void _syncVolume() => _player.setVolume(_state.muted ? 0 : 100);

  void _toggleMute() {
    HapticFeedback.selectionClick();
    _update(_state.copyWith(muted: !_state.muted));
  }

  // ── Export ──

  Future<void> _export() async {
    if (_exporting || _total == Duration.zero) return;
    if (_draft != null) _closeTool(apply: true);
    final s = _committed;
    final look = s.look;
    final turns = look.quarterTurns % 4;
    final geometry = turns != 0 || look.flipH || look.flipV;
    final colors = look.colorMatrix;
    final colorEdited =
        look.filter != _Filter.original ||
        _videoAdjusts.any((a) => a.read(look) != 0);

    if (!s.trimmed(_total) && !s.muted && !geometry && !colorEdited) {
      Navigator.of(context).pop(widget.source);
      return;
    }

    await _player.pause();
    final data = pve.VideoRenderData(
      videoSegments: [
        pve.VideoSegment(video: pve.EditorVideo.file(widget.source)),
      ],
      startTime: s.start > Duration.zero ? s.start : null,
      endTime: _end < _total ? _end : null,
      enableAudio: !s.muted,
      transform: geometry
          ? pve.ExportTransform(
              rotateTurns: turns,
              flipX: look.flipH,
              flipY: look.flipV,
            )
          : null,
      colorFilters: colorEdited ? [pve.ColorFilter(matrix: colors)] : const [],
      bitrate: 8000000,
      shouldOptimizeForNetworkUse: true,
    );
    setState(() {
      _exporting = true;
      _progress = 0;
      _renderId = data.id;
    });
    final sub = pve.ProVideoEditor.instance.progressStreamById(data.id).listen((
      p,
    ) {
      if (mounted) setState(() => _progress = p.progress.clamp(0, 1));
    });
    try {
      final path =
          '${Directory.systemTemp.path}/statut_${DateTime.now().millisecondsSinceEpoch}.mp4';
      await pve.ProVideoEditor.instance.renderVideoToFile(path, data);
      if (mounted) Navigator.of(context).pop(File(path));
    } catch (e) {
      if (!mounted) return;
      setState(() => _exporting = false);
      _player.play();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Impossible de préparer la vidéo')),
      );
    } finally {
      await sub.cancel();
    }
  }

  Future<void> _close() async {
    if (_exporting) return;
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
      builder: (ctx) => _QuitSheet(
        palette: p,
        message: 'La vidéo ne sera pas ajoutée au statut.',
      ),
    );
    if (quit == true && mounted) Navigator.of(context).pop();
  }

  // ── UI ──

  @override
  Widget build(BuildContext context) {
    final p = AccountPalette.of(context);
    final s = _state;

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
                onUndo: () {
                  setState(() => _index--);
                  _syncVolume();
                },
                onRedo: () {
                  setState(() => _index++);
                  _syncVolume();
                },
                onCompare: (v) => setState(() => _compare = v),
                onDone: _export,
              ),
              Expanded(
                child: ColoredBox(
                  color: p.bg,
                  child: _loadError != null
                      ? Center(
                          child: Text(
                            _loadError!,
                            style: AppTheme.sansText(size: 15, color: p.muted),
                          ),
                        )
                      : Stack(
                          fit: StackFit.expand,
                          children: [
                            Padding(
                              padding: const EdgeInsets.all(16),
                              child: _VideoPreview(
                                controller: _controller,
                                size: _size,
                                state: s,
                                original: _compare,
                                onTap: () => _player.playOrPause(),
                              ),
                            ),
                            if (_compare)
                              const Positioned(
                                top: 26,
                                left: 0,
                                right: 0,
                                child: Center(child: _Chip(text: 'Original')),
                              ),
                            if (_exporting)
                              _RenderOverlay(palette: p, progress: _progress),
                          ],
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
                    ? _VideoToolBar(
                        key: const ValueKey('tools'),
                        palette: p,
                        state: _committed,
                        total: _total,
                        onTool: _openTool,
                        onMute: _toggleMute,
                      )
                    : _PanelFrame(
                        key: ValueKey(_tool),
                        palette: p,
                        title: _tool!.label,
                        onCancel: () => _closeTool(apply: false),
                        onApply: () => _closeTool(apply: true),
                        child: _panelBody(p, s),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _panelBody(AccountPalette p, _VideoState s) {
    void look(_EditState l) => _update(s.copyWith(look: l));
    return switch (_tool!) {
      _VTool.couper => _TrimPanel(
        palette: p,
        thumbs: _thumbs,
        total: _total,
        start: s.start,
        end: _end,
        max: widget.maxDuration,
        onChanged: (start, end) {
          final moved = start != s.start;
          _update(s.copyWith(start: start, end: end));
          _player.seek(moved ? start : end - const Duration(seconds: 1));
        },
      ),
      _VTool.filtres =>
        _poster == null
            ? const SizedBox(
                height: 120,
                child: Center(child: CircularProgressIndicator(color: _accent)),
              )
            : _FilterPanel(
                palette: p,
                source: _poster!,
                state: s.look,
                onChanged: look,
              ),
      _VTool.rotation => _RotatePanel(
        palette: p,
        state: s.look,
        fineAngle: false,
        onChanged: look,
      ),
      _VTool.reglages => _AdjustPanel(
        palette: p,
        adjusts: _videoAdjusts,
        current: _adjust,
        state: s.look,
        onAdjust: (a) => setState(() => _adjust = a),
        onChanged: look,
      ),
    };
  }
}

/// Lecteur avec l'aperçu des filtres, rotations et miroirs.
class _VideoPreview extends StatelessWidget {
  const _VideoPreview({
    required this.controller,
    required this.size,
    required this.state,
    required this.original,
    required this.onTap,
  });

  final VideoController controller;
  final Size size;
  final _VideoState state;
  final bool original;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final look = state.look;
    final turns = original ? 0 : look.quarterTurns % 4;
    final aspect = size.height == 0 ? 9 / 16 : size.width / size.height;
    Widget video = AspectRatio(
      aspectRatio: aspect,
      child: Video(
        controller: controller,
        fit: BoxFit.contain,
        fill: Colors.black,
        controls: NoVideoControls,
      ),
    );
    if (!original) {
      video = ColorFiltered(
        colorFilter: ColorFilter.matrix(look.colorMatrix),
        child: Transform.scale(
          scaleX: look.flipH ? -1 : 1,
          scaleY: look.flipV ? -1 : 1,
          child: video,
        ),
      );
    }
    return GestureDetector(
      onTap: onTap,
      child: Center(
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: RotatedBox(quarterTurns: turns, child: video),
        ),
      ),
    );
  }
}

class _VideoToolBar extends StatelessWidget {
  const _VideoToolBar({
    super.key,
    required this.palette,
    required this.state,
    required this.total,
    required this.onTool,
    required this.onMute,
  });

  final AccountPalette palette;
  final _VideoState state;
  final Duration total;
  final ValueChanged<_VTool> onTool;
  final VoidCallback onMute;

  bool _edited(_VTool t) {
    final l = state.look;
    return switch (t) {
      _VTool.couper => state.trimmed(total),
      _VTool.filtres => l.filter != _Filter.original,
      _VTool.rotation => l.quarterTurns % 4 != 0 || l.flipH || l.flipV,
      _VTool.reglages => _videoAdjusts.any((a) => a.read(l) != 0),
    };
  }

  @override
  Widget build(BuildContext context) {
    final p = palette;
    final kept = (state.end ?? total) - state.start;
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 18, 8, 14),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              for (final t in _VTool.values)
                _RoundTool(
                  palette: p,
                  icon: t.icon,
                  label: t.label,
                  dot: _edited(t),
                  onTap: () => onTool(t),
                ),
              _RoundTool(
                palette: p,
                icon: state.muted ? LucideIcons.volumeX : LucideIcons.volume2,
                label: state.muted ? 'Muet' : 'Son',
                selected: state.muted,
                onTap: onMute,
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            total == Duration.zero
                ? 'Chargement de la vidéo…'
                : 'Touchez la vidéo pour lire / mettre en pause · '
                      '${_fmt(kept)} conservées',
            style: AppTheme.sansText(size: 12, color: p.muted, height: 1.2),
          ),
        ],
      ),
    );
  }
}

String _fmt(Duration d) {
  final s = d.inMilliseconds / 1000;
  if (s <= 60) return '${s.toStringAsFixed(s < 10 ? 1 : 0)} s';
  final m = d.inMinutes;
  final r = d.inSeconds % 60;
  return '$m:${r.toString().padLeft(2, '0')}';
}

String _clock(Duration d) {
  final m = d.inMinutes;
  final s = d.inSeconds % 60;
  final t = (d.inMilliseconds % 1000) ~/ 100;
  return '$m:${s.toString().padLeft(2, '0')}.$t';
}

/// Bande de miniatures avec deux poignées pour garder une portion.
class _TrimPanel extends StatelessWidget {
  const _TrimPanel({
    required this.palette,
    required this.thumbs,
    required this.total,
    required this.start,
    required this.end,
    required this.max,
    required this.onChanged,
  });

  final AccountPalette palette;
  final List<Uint8List> thumbs;
  final Duration total;
  final Duration start;
  final Duration end;
  final Duration max;
  final void Function(Duration start, Duration end) onChanged;

  static const _minKept = Duration(seconds: 1);
  static const _handle = 16.0;
  static const _height = 56.0;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    final totalUs = math.max(total.inMicroseconds, 1);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              _TimeChip(text: _clock(start), palette: p),
              Expanded(
                child: Text(
                  '${_fmt(end - start)} · ${_fmt(max)} max',
                  textAlign: TextAlign.center,
                  style: AppTheme.sansText(
                    size: 13,
                    weight: FontWeight.w700,
                    color: _accent,
                  ),
                ),
              ),
              _TimeChip(text: _clock(end), palette: p),
            ],
          ),
          const SizedBox(height: 12),
          LayoutBuilder(
            builder: (context, c) {
              final width = c.maxWidth - _handle * 2;
              double x(Duration d) => d.inMicroseconds / totalUs * width;
              Duration at(double px) => Duration(
                microseconds: (px.clamp(0, width) / width * totalUs).round(),
              );
              final left = x(start), right = x(end);

              void dragStart(DragUpdateDetails d) {
                var s = at(left + d.delta.dx);
                if (end - s < _minKept) s = end - _minKept;
                var e = end;
                if (e - s > max) e = s + max; // la fenêtre suit
                onChanged(s < Duration.zero ? Duration.zero : s, e);
              }

              void dragEnd(DragUpdateDetails d) {
                var e = at(right + d.delta.dx);
                if (e - start < _minKept) e = start + _minKept;
                if (e > total) e = total;
                var s = start;
                if (e - s > max) s = e - max;
                onChanged(s, e);
              }

              void dragWindow(DragUpdateDetails d) {
                final len = end - start;
                var s = at(left + d.delta.dx);
                if (s + len > total) s = total - len;
                onChanged(s, s + len);
              }

              return SizedBox(
                height: _height,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned(
                      left: _handle,
                      right: _handle,
                      top: 0,
                      bottom: 0,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: thumbs.isEmpty
                            ? ColoredBox(color: p.iconBg)
                            : Row(
                                children: [
                                  for (final t in thumbs)
                                    Expanded(
                                      child: Image.memory(
                                        t,
                                        fit: BoxFit.cover,
                                        height: _height,
                                        gaplessPlayback: true,
                                      ),
                                    ),
                                ],
                              ),
                      ),
                    ),
                    // Parties écartées assombries.
                    Positioned(
                      left: _handle,
                      width: left,
                      top: 0,
                      bottom: 0,
                      child: ColoredBox(color: p.group.withValues(alpha: 0.72)),
                    ),
                    Positioned(
                      left: _handle + right,
                      right: _handle,
                      top: 0,
                      bottom: 0,
                      child: ColoredBox(color: p.group.withValues(alpha: 0.72)),
                    ),
                    // Fenêtre conservée (glisser pour la déplacer).
                    Positioned(
                      left: _handle + left,
                      width: math.max(right - left, 0),
                      top: 0,
                      bottom: 0,
                      child: GestureDetector(
                        onHorizontalDragUpdate: dragWindow,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            border: Border.symmetric(
                              horizontal: BorderSide(color: _accent, width: 3),
                            ),
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      left: left,
                      top: 0,
                      bottom: 0,
                      child: _TrimHandle(left: true, onDrag: dragStart),
                    ),
                    Positioned(
                      left: _handle + right,
                      top: 0,
                      bottom: 0,
                      child: _TrimHandle(left: false, onDrag: dragEnd),
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 10),
          Text(
            'Faites glisser les poignées vertes pour garder un passage',
            style: AppTheme.sansText(size: 12, color: p.muted, height: 1.2),
          ),
        ],
      ),
    );
  }
}

class _TrimHandle extends StatelessWidget {
  const _TrimHandle({required this.left, required this.onDrag});

  final bool left;
  final GestureDragUpdateCallback onDrag;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onHorizontalDragStart: (_) => HapticFeedback.selectionClick(),
      onHorizontalDragUpdate: onDrag,
      child: Container(
        width: _TrimPanel._handle,
        decoration: BoxDecoration(
          color: _accent,
          borderRadius: BorderRadius.horizontal(
            left: left ? const Radius.circular(8) : Radius.zero,
            right: left ? Radius.zero : const Radius.circular(8),
          ),
        ),
        alignment: Alignment.center,
        child: Container(
          width: 3,
          height: 18,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
      ),
    );
  }
}

class _TimeChip extends StatelessWidget {
  const _TimeChip({required this.text, required this.palette});

  final String text;
  final AccountPalette palette;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: palette.iconBg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        text,
        style: AppTheme.sansText(
          size: 12,
          weight: FontWeight.w600,
          color: palette.fg,
          height: 1.2,
        ),
      ),
    );
  }
}

class _RenderOverlay extends StatelessWidget {
  const _RenderOverlay({required this.palette, required this.progress});

  final AccountPalette palette;
  final double progress;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: palette.bg.withValues(alpha: 0.82),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 64,
              height: 64,
              child: CircularProgressIndicator(
                value: progress > 0 ? progress : null,
                strokeWidth: 4,
                color: _accent,
                backgroundColor: palette.iconBg,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Préparation de la vidéo… ${(progress * 100).round()} %',
              style: AppTheme.sansText(
                size: 15,
                weight: FontWeight.w600,
                color: palette.fg,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
