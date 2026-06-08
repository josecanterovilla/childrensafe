import 'dart:async';

import 'package:childrensafe_shared/childrensafe_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

/// Mapa con la última ubicación conocida de un menor. Usa OpenStreetMap (sin API key).
/// Se refresca al entrar, manualmente y de forma automática cada 20 s.
class ChildMapScreen extends StatefulWidget {
  const ChildMapScreen({
    super.key,
    required this.api,
    required this.familyId,
    required this.child,
  });

  final ApiClient api;
  final String familyId;
  final ChildProfile child;

  @override
  State<ChildMapScreen> createState() => _ChildMapScreenState();
}

class _ChildMapScreenState extends State<ChildMapScreen> {
  final MapController _map = MapController();
  Timer? _timer;

  LocationPoint? _point;
  bool _loading = true;
  bool _noData = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _refresh();
    _timer = Timer.periodic(const Duration(seconds: 20), (_) => _refresh());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      final raw = await widget.api.latestLocation(widget.familyId, widget.child.id);
      final point = LocationPoint.fromJson(raw);
      if (!mounted) return;
      setState(() {
        _point = point;
        _noData = false;
        _error = null;
        _loading = false;
      });
      _map.move(LatLng(point.latitude, point.longitude), 16);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        if (e.statusCode == 404) {
          _noData = true; // el menor aún no ha compartido ubicación
          _error = null;
        } else {
          _error = e.message;
        }
      });
    }
  }

  Future<void> _openExternalMaps() async {
    final p = _point;
    if (p == null) return;
    final uri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}',
    );
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.child.displayName),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            icon: const Icon(Icons.refresh),
            onPressed: _refresh,
          ),
        ],
      ),
      body: _buildBody(context),
      floatingActionButton: _point != null
          ? FloatingActionButton.extended(
              onPressed: _openExternalMaps,
              icon: const Icon(Icons.directions),
              label: const Text('Cómo llegar'),
            )
          : null,
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_noData) {
      return _Centered(
        icon: Icons.location_searching,
        title: 'Aún sin ubicación',
        subtitle:
            '${widget.child.displayName} todavía no ha compartido su ubicación. Aparecerá aquí '
            'en cuanto su teléfono envíe el primer punto.',
      );
    }
    if (_error != null) {
      return _Centered(
        icon: Icons.cloud_off,
        title: 'No pudimos cargar la ubicación',
        subtitle: _error!,
      );
    }
    final p = _point!;
    final center = LatLng(p.latitude, p.longitude);
    return Stack(
      children: [
        FlutterMap(
          mapController: _map,
          options: MapOptions(initialCenter: center, initialZoom: 16),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'app.childrensafe.parent',
            ),
            MarkerLayer(
              markers: [
                Marker(
                  point: center,
                  width: 48,
                  height: 48,
                  child: const Icon(Icons.location_on, color: AppTheme.critical, size: 48),
                ),
              ],
            ),
          ],
        ),
        Positioned(
          left: 16,
          right: 16,
          bottom: 16,
          child: _InfoBar(point: p),
        ),
      ],
    );
  }
}

/// Barra inferior con hora del último punto, batería y precisión.
class _InfoBar extends StatelessWidget {
  const _InfoBar({required this.point});

  final LocationPoint point;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            const Icon(Icons.schedule, size: 18),
            const SizedBox(width: 6),
            Text(_relativeTime(point.recordedAt)),
            const Spacer(),
            if (point.batteryLevel != null) ...[
              const Icon(Icons.battery_full, size: 18),
              const SizedBox(width: 4),
              Text('${point.batteryLevel}%'),
              const SizedBox(width: 12),
            ],
            if (point.accuracy != null) ...[
              const Icon(Icons.my_location, size: 18),
              const SizedBox(width: 4),
              Text('±${point.accuracy!.round()} m'),
            ],
          ],
        ),
      ),
    );
  }
}

String _relativeTime(DateTime t) {
  final d = DateTime.now().difference(t);
  if (d.inSeconds < 60) return 'Actualizado ahora';
  if (d.inMinutes < 60) return 'Hace ${d.inMinutes} min';
  if (d.inHours < 24) return 'Hace ${d.inHours} h';
  return 'Hace ${d.inDays} d';
}

class _Centered extends StatelessWidget {
  const _Centered({required this.icon, required this.title, required this.subtitle});

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 64, color: Theme.of(context).colorScheme.outline),
            const SizedBox(height: 16),
            Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(subtitle, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }
}
