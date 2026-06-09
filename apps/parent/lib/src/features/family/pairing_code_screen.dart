import 'package:childrensafe_shared/childrensafe_shared.dart';
import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

/// (PARENT) Genera un código de emparejamiento de un solo uso y lo muestra como
/// código legible + QR. El menor lo escribe o escanea en su app para vincularse.
class PairingCodeScreen extends StatefulWidget {
  const PairingCodeScreen({super.key, required this.api, required this.family});

  final ApiClient api;
  final FamilySummary family;

  @override
  State<PairingCodeScreen> createState() => _PairingCodeScreenState();
}

class _PairingCodeScreenState extends State<PairingCodeScreen> {
  final _name = TextEditingController();
  String _ageBand = 'CHILD';
  bool _loading = false;
  String? _error;

  // Resultado del backend.
  String? _code;
  String? _qrPayload;
  DateTime? _expiresAt;

  static const _ageBands = <(String, String)>[
    ('EARLY_CHILD', 'Primera infancia (0–7)'),
    ('CHILD', 'Niño/a (8–11)'),
    ('PRETEEN', 'Preadolescente (12–14)'),
    ('TEEN', 'Adolescente (15–17)'),
  ];

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _generate() async {
    if (_name.text.trim().isEmpty) {
      setState(() => _error = 'Escribe el nombre del menor.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await widget.api.createPairingCode(
        widget.family.familyId,
        childDisplayName: _name.text.trim(),
        childAgeBand: _ageBand,
      );
      setState(() {
        _code = res['code'] as String?;
        _qrPayload = res['qrPayload'] as String?;
        _expiresAt = DateTime.tryParse(res['expiresAt'] as String? ?? '');
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasCode = _code != null;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Vincular un menor'),
        // Si ya se generó un código, al volver avisamos para refrescar la lista.
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(hasCode),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: hasCode ? _buildResult(context) : _buildForm(context),
        ),
      ),
    );
  }

  Widget _buildForm(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Datos del menor', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 4),
        Text(
          'Crearemos un código de un solo uso. El menor lo introduce en su app, que le '
          'explicará de forma transparente qué se comparte.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: 24),
        TextField(
          controller: _name,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(labelText: 'Nombre del menor'),
        ),
        const SizedBox(height: 16),
        DropdownButtonFormField<String>(
          initialValue: _ageBand,
          decoration: const InputDecoration(labelText: 'Etapa de edad'),
          items: [
            for (final (value, label) in _ageBands)
              DropdownMenuItem(value: value, child: Text(label)),
          ],
          onChanged: (v) => setState(() => _ageBand = v ?? 'CHILD'),
        ),
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
        ],
        const SizedBox(height: 24),
        FilledButton(
          onPressed: _loading ? null : _generate,
          child: _loading
              ? const SizedBox(
                  height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Generar código'),
        ),
      ],
    );
  }

  Widget _buildResult(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Comparte este código con ${_name.text.trim()}',
            textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 24),
        if (_qrPayload != null)
          Center(
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
              ),
              child: QrImageView(
                data: _qrPayload!,
                version: QrVersions.auto,
                size: 220,
              ),
            ),
          ),
        const SizedBox(height: 24),
        SelectableText(
          _code ?? '',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                letterSpacing: 4,
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 8),
        Text(
          _expiresAt != null
              ? 'Caduca ${_relativeExpiry(_expiresAt!)}. Es de un solo uso.'
              : 'Es de un solo uso.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 32),
        OutlinedButton.icon(
          onPressed: () => Navigator.of(context).pop(true),
          icon: const Icon(Icons.check),
          label: const Text('Listo'),
        ),
      ],
    );
  }
}

String _relativeExpiry(DateTime t) {
  final d = t.difference(DateTime.now());
  if (d.isNegative) return 'ya';
  if (d.inMinutes < 60) return 'en ${d.inMinutes} min';
  return 'en ${d.inHours} h';
}
