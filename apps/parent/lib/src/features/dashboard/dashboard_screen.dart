import 'package:childrensafe_shared/childrensafe_shared.dart';
import 'package:flutter/material.dart';

/// Panel del tutor. Carga las familias y muestra un resumen. Estados vacíos cuidados
/// y lenguaje humano. (Mapa, reglas y reportes se añaden como pestañas en Fase 1/2.)
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<List<FamilySummary>> _families;

  @override
  void initState() {
    super.initState();
    _families = _load();
  }

  Future<List<FamilySummary>> _load() async {
    final raw = await widget.api.listFamilies();
    return raw
        .cast<Map<String, dynamic>>()
        .map(FamilySummary.fromJson)
        .toList(growable: false);
  }

  Future<void> _logout() async {
    await widget.api.logout();
    if (mounted) Navigator.of(context).popUntil((r) => r.isFirst);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tu familia'),
        actions: [
          IconButton(
            onPressed: _logout,
            icon: const Icon(Icons.logout),
            tooltip: 'Cerrar sesión',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => setState(() => _families = _load()),
        child: FutureBuilder<List<FamilySummary>>(
          future: _families,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return const _Message(
                icon: Icons.cloud_off,
                title: 'No pudimos cargar tus datos',
                subtitle: 'Revisa tu conexión y desliza para reintentar.',
              );
            }
            final families = snap.data ?? const [];
            if (families.isEmpty) {
              return const _Message(
                icon: Icons.family_restroom,
                title: 'Aún no tienes a nadie vinculado',
                subtitle:
                    'Crea un código de emparejamiento para enlazar el teléfono de tu hijo o hija.',
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: families.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (_, i) {
                final f = families[i];
                return Card(
                  child: ListTile(
                    leading: const CircleAvatar(child: Icon(Icons.home_outlined)),
                    title: Text(f.name),
                    subtitle: Text('Tu rol: ${f.role.name}'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {/* Navega al detalle/mapa de la familia */},
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.icon, required this.title, required this.subtitle});

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return ListView(
      // ListView para que RefreshIndicator funcione incluso con el estado vacío.
      children: [
        const SizedBox(height: 120),
        Icon(icon, size: 64, color: Theme.of(context).colorScheme.outline),
        const SizedBox(height: 16),
        Text(title,
            textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
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
