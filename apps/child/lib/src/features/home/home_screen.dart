import 'package:childrensafe_shared/childrensafe_shared.dart';
import 'package:flutter/material.dart';

/// Inicio del menor: claro, tranquilo y no intimidante.
/// - Estado "seguro".
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

  bool _sending = false;

  @override
  void dispose() {
    _hold.dispose();
    super.dispose();
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
