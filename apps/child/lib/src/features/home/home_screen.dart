import 'package:childrensafe_shared/childrensafe_shared.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../services/location_reporter.dart';

/// Inicio del menor: claro, tranquilo y no intimidante.
/// - Estado "seguro".
/// - Comparte la ubicación de forma transparente (con tarjeta de estado y permisos claros).
/// - Botón SOS grande que se activa al MANTENER 3 segundos (evita activaciones por error).
/// - Botón "Llegué bien".
/// - Centro de transparencia (qué se comparte).
class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.api,
    required this.familyId,
    required this.childName,
  });

  final ApiClient api;
  final String familyId;
  final String childName;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _hold = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 3),
  )..addStatusListener((status) {
      if (status == AnimationStatus.completed) _fireSos();
    });

  late final LocationReporter _reporter =
      LocationReporter(api: widget.api, familyId: widget.familyId);

  bool _sending = false;
  LocationReadiness? _locStatus;

  @override
  void initState() {
    super.initState();
    _startSharing();
  }

  @override
  void dispose() {
    _hold.dispose();
    _reporter.stop();
    super.dispose();
  }

  Future<void> _startSharing() async {
    final status = await _reporter.start();
    if (mounted) setState(() => _locStatus = status);
  }

  /// Reacción a un toque en la tarjeta de ubicación según el estado del permiso.
  Future<void> _fixLocation() async {
    switch (_locStatus) {
      case LocationReadiness.serviceOff:
        await Geolocator.openLocationSettings();
      case LocationReadiness.deniedForever:
        await Geolocator.openAppSettings();
      default:
        await _startSharing();
    }
  }

  Future<void> _fireSos() async {
    if (_sending) return;
    setState(() => _sending = true);
    try {
      await widget.api.triggerSos(widget.familyId, message: 'Necesito ayuda');
      _toast('Tu familia ha sido avisada. Estás acompañado.');
    } on ApiException catch (e) {
      _toast(e.message);
    } finally {
      if (mounted) {
        _hold.reset();
        setState(() => _sending = false);
      }
    }
  }

  Future<void> _arrived() async {
    try {
      await widget.api.arrived(widget.familyId, place: 'Casa');
      _toast('¡Avisamos que llegaste bien!');
    } on ApiException catch (e) {
      _toast(e.message);
    }
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Estás seguro'),
        actions: [
          IconButton(
            tooltip: 'Qué se comparte',
            icon: const Icon(Icons.visibility_outlined),
            onPressed: _showTransparency,
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      const Icon(Icons.verified_user, color: AppTheme.ok, size: 32),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Hola, ${widget.childName}',
                                style: Theme.of(context).textTheme.titleMedium),
                            const Text('Tu familia está cuidándote.'),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              _LocationStatusCard(status: _locStatus, onTap: _fixLocation),
              const Spacer(),
              // Botón SOS: mantener 3 segundos.
              GestureDetector(
                onTapDown: (_) => _hold.forward(),
                onTapUp: (_) => _hold.reverse(),
                onTapCancel: () => _hold.reverse(),
                child: AnimatedBuilder(
                  animation: _hold,
                  builder: (context, _) {
                    return SizedBox(
                      width: 220,
                      height: 220,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          SizedBox(
                            width: 220,
                            height: 220,
                            child: CircularProgressIndicator(
                              value: _hold.value == 0 ? null : _hold.value,
                              strokeWidth: 8,
                              backgroundColor: scheme.surfaceContainerHighest,
                              valueColor: const AlwaysStoppedAnimation(AppTheme.critical),
                            ),
                          ),
                          Container(
                            width: 180,
                            height: 180,
                            decoration: const BoxDecoration(
                              color: AppTheme.critical,
                              shape: BoxShape.circle,
                            ),
                            alignment: Alignment.center,
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.sos, color: Colors.white, size: 56),
                                Text(
                                  _sending ? 'Enviando…' : 'Mantén 3 s',
                                  style: const TextStyle(color: Colors.white, fontSize: 16),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 12),
              Text('Si te sientes en peligro, mantén presionado el botón.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium),
              const Spacer(),
              OutlinedButton.icon(
                onPressed: _arrived,
                icon: const Icon(Icons.check_circle_outline),
                label: const Text('Llegué bien'),
                style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(52)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showTransparency() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Qué comparte esta app',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            const _Bullet('Tu ubicación, para que tu familia sepa que estás bien.'),
            const _Bullet('Si activas SOS o avisas que llegaste bien.'),
            const _Bullet('El nivel de batería de tu teléfono.'),
            const SizedBox(height: 12),
            const Text('Nunca se leen tus mensajes ni tus fotos.'),
          ],
        ),
      ),
    );
  }
}

/// Tarjeta que muestra, con lenguaje claro, si se está compartiendo la ubicación.
/// Si falta permiso o el GPS está apagado, toca para resolverlo.
class _LocationStatusCard extends StatelessWidget {
  const _LocationStatusCard({required this.status, required this.onTap});

  final LocationReadiness? status;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final (IconData icon, Color color, String title, String subtitle, bool actionable) =
        switch (status) {
      null => (
        Icons.location_searching,
        Theme.of(context).colorScheme.outline,
        'Activando ubicación…',
        'Un momento, estamos preparándolo.',
        false,
      ),
      LocationReadiness.ready => (
        Icons.location_on,
        AppTheme.ok,
        'Compartiendo tu ubicación',
        'Tu familia sabe que estás bien.',
        false,
      ),
      LocationReadiness.serviceOff => (
        Icons.location_off,
        AppTheme.warning,
        'La ubicación está apagada',
        'Toca para encender el GPS.',
        true,
      ),
      LocationReadiness.denied => (
        Icons.location_disabled,
        AppTheme.warning,
        'Falta el permiso de ubicación',
        'Toca para concederlo.',
        true,
      ),
      LocationReadiness.deniedForever => (
        Icons.location_disabled,
        AppTheme.critical,
        'Permiso de ubicación bloqueado',
        'Toca para abrir los ajustes y activarlo.',
        true,
      ),
    };

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: actionable ? onTap : null,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Icon(icon, color: color, size: 28),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.titleSmall),
                    Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
              if (actionable) const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}

class _Bullet extends StatelessWidget {
  const _Bullet(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('•  '),
          Expanded(child: Text(text)),
        ],
      ),
    );
  }
}
