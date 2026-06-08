import 'package:childrensafe_shared/childrensafe_shared.dart';
import 'package:flutter/material.dart';

import 'child_map_screen.dart';
import 'pairing_code_screen.dart';

/// Detalle de una familia para el tutor: menores (con acceso al mapa) y alertas.
/// Desde aquí el PARENT puede generar un código para vincular el teléfono de un menor.
class FamilyDetailScreen extends StatefulWidget {
  const FamilyDetailScreen({super.key, required this.api, required this.family});

  final ApiClient api;
  final FamilySummary family;

  @override
  State<FamilyDetailScreen> createState() => _FamilyDetailScreenState();
}

class _FamilyDetailScreenState extends State<FamilyDetailScreen> {
  // Clave para forzar recarga de los menores tras vincular uno nuevo.
  int _reload = 0;

  Future<void> _addChild() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => PairingCodeScreen(api: widget.api, family: widget.family),
      ),
    );
    if (created == true && mounted) setState(() => _reload++);
  }

  @override
  Widget build(BuildContext context) {
    final canPair = widget.family.role == MemberRole.parent;
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.family.name),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Menores', icon: Icon(Icons.child_care)),
              Tab(text: 'Alertas', icon: Icon(Icons.notifications_outlined)),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _ChildrenTab(api: widget.api, family: widget.family, reloadToken: _reload),
            _AlertsTab(api: widget.api, familyId: widget.family.familyId),
          ],
        ),
        floatingActionButton: canPair
            ? FloatingActionButton.extended(
                onPressed: _addChild,
                icon: const Icon(Icons.qr_code_2),
                label: const Text('Vincular'),
              )
            : null,
      ),
    );
  }
}

// ─────────────────────────── Tab: Menores ───────────────────────────

class _ChildrenTab extends StatefulWidget {
  const _ChildrenTab({required this.api, required this.family, required this.reloadToken});

  final ApiClient api;
  final FamilySummary family;
  final int reloadToken;

  @override
  State<_ChildrenTab> createState() => _ChildrenTabState();
}

class _ChildrenTabState extends State<_ChildrenTab> {
  late Future<List<ChildProfile>> _children = _load();

  Future<List<ChildProfile>> _load() async {
    final raw = await widget.api.listChildren(widget.family.familyId);
    return raw
        .cast<Map<String, dynamic>>()
        .map(ChildProfile.fromJson)
        .toList(growable: false);
  }

  @override
  void didUpdateWidget(_ChildrenTab old) {
    super.didUpdateWidget(old);
    if (old.reloadToken != widget.reloadToken) {
      setState(() => _children = _load());
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => setState(() => _children = _load()),
      child: FutureBuilder<List<ChildProfile>>(
        future: _children,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return const _Centered(
              icon: Icons.cloud_off,
              title: 'No pudimos cargar los menores',
              subtitle: 'Desliza para reintentar.',
            );
          }
          final children = snap.data ?? const [];
          if (children.isEmpty) {
            return const _Centered(
              icon: Icons.child_care,
              title: 'Aún no has vinculado a ningún menor',
              subtitle: 'Usa el botón "Vincular" para enlazar su teléfono con un código.',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: children.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (_, i) {
              final c = children[i];
              return Card(
                child: ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.person_outline)),
                  title: Text(c.displayName),
                  subtitle: Text(_ageBandLabel(c.ageBand)),
                  trailing: const Icon(Icons.map_outlined),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => ChildMapScreen(
                        api: widget.api,
                        familyId: widget.family.familyId,
                        child: c,
                      ),
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

String _ageBandLabel(String band) => switch (band) {
      'EARLY_CHILD' => 'Primera infancia (0–7)',
      'CHILD' => 'Niño/a (8–11)',
      'PRETEEN' => 'Preadolescente (12–14)',
      'TEEN' => 'Adolescente (15–17)',
      _ => band,
    };

// ─────────────────────────── Tab: Alertas ───────────────────────────

class _AlertsTab extends StatefulWidget {
  const _AlertsTab({required this.api, required this.familyId});

  final ApiClient api;
  final String familyId;

  @override
  State<_AlertsTab> createState() => _AlertsTabState();
}

class _AlertsTabState extends State<_AlertsTab> {
  late Future<List<AlertItem>> _alerts = _load();

  Future<List<AlertItem>> _load() async {
    final raw = await widget.api.listAlerts(widget.familyId);
    return raw.cast<Map<String, dynamic>>().map(AlertItem.fromJson).toList(growable: false);
  }

  Future<void> _acknowledge(AlertItem a) async {
    try {
      await widget.api.acknowledgeAlert(widget.familyId, a.id);
      if (mounted) setState(() => _alerts = _load());
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => setState(() => _alerts = _load()),
      child: FutureBuilder<List<AlertItem>>(
        future: _alerts,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return const _Centered(
              icon: Icons.cloud_off,
              title: 'No pudimos cargar las alertas',
              subtitle: 'Desliza para reintentar.',
            );
          }
          final alerts = snap.data ?? const [];
          if (alerts.isEmpty) {
            return const _Centered(
              icon: Icons.check_circle_outline,
              title: 'Todo en calma',
              subtitle: 'No hay alertas. Te avisaremos si algo necesita tu atención.',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: alerts.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (_, i) => _AlertCard(alert: alerts[i], onAck: () => _acknowledge(alerts[i])),
          );
        },
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  const _AlertCard({required this.alert, required this.onAck});

  final AlertItem alert;
  final VoidCallback onAck;

  @override
  Widget build(BuildContext context) {
    final color = switch (alert.severity) {
      AlertSeverity.critical => AppTheme.critical,
      AlertSeverity.warning => AppTheme.warning,
      AlertSeverity.info => AppTheme.ok,
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(_iconFor(alert.type), color: color),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(alert.title, style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 4),
                  Text(alert.message, style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 4),
                  Text(_relativeTime(alert.createdAt),
                      style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Marcar como vista',
              icon: const Icon(Icons.done),
              onPressed: onAck,
            ),
          ],
        ),
      ),
    );
  }

  static IconData _iconFor(String type) => switch (type) {
        'SOS' => Icons.sos,
        'GEOFENCE_ENTER' => Icons.login,
        'GEOFENCE_EXIT' => Icons.logout,
        'LEFT_SAFE_PERIMETER' => Icons.run_circle_outlined,
        'LOW_BATTERY' => Icons.battery_alert,
        'LOCATION_PERMISSION_OFF' || 'LOCATION_DISABLED' => Icons.location_off,
        'ARRIVED_SAFELY' => Icons.check_circle_outline,
        _ => Icons.notifications_outlined,
      };
}

String _relativeTime(DateTime t) {
  final d = DateTime.now().difference(t);
  if (d.inMinutes < 1) return 'Ahora mismo';
  if (d.inMinutes < 60) return 'Hace ${d.inMinutes} min';
  if (d.inHours < 24) return 'Hace ${d.inHours} h';
  return 'Hace ${d.inDays} d';
}

// ─────────────────────────── Común ───────────────────────────

class _Centered extends StatelessWidget {
  const _Centered({required this.icon, required this.title, required this.subtitle});

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return ListView(
      // ListView para que RefreshIndicator funcione también con el estado vacío.
      children: [
        const SizedBox(height: 120),
        Icon(icon, size: 64, color: Theme.of(context).colorScheme.outline),
        const SizedBox(height: 16),
        Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Text(subtitle,
              textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium),
        ),
      ],
    );
  }
}
