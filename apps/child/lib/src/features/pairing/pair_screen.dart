import 'package:childrensafe_shared/childrensafe_shared.dart';
import 'package:flutter/material.dart';

import '../../services/device_identity.dart';
import '../home/home_screen.dart';

/// Pantalla de emparejamiento del menor. Transparente: explica qué va a pasar.
/// El deviceUuid (estable, no publicitario) y la plataforma se obtienen de [DeviceIdentity].
class PairScreen extends StatefulWidget {
  const PairScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<PairScreen> createState() => _PairScreenState();
}

class _PairScreenState extends State<PairScreen> {
  final _code = TextEditingController();
  final _name = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _join() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final device = await DeviceIdentity().describe();
      final res = await widget.api.joinFamily(
        code: _code.text.trim(),
        displayName: _name.text.trim().isEmpty ? null : _name.text.trim(),
        device: device,
      );
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(
        builder: (_) => HomeScreen(
          api: widget.api,
          familyId: res['familyId'] as String,
          childName: _name.text.trim().isEmpty ? 'Tú' : _name.text.trim(),
        ),
      ));
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Unirme a mi familia')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.qr_code_2, size: 56),
              const SizedBox(height: 16),
              Text('Escribe el código que te dio tu familia',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Text(
                'Esta app te ayuda a estar seguro. Tu familia podrá ver tu ubicación para '
                'cuidarte. Tú siempre sabrás qué se comparte.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 28),
              TextField(
                controller: _code,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(labelText: 'Código (ej. JX4K-82MZ)'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Tu nombre (opcional)'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _loading ? null : _join,
                child: _loading
                    ? const SizedBox(
                        height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Unirme'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
