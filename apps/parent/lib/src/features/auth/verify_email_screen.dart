import 'dart:async';

import 'package:childrensafe_shared/childrensafe_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../dashboard/dashboard_screen.dart';

/// Confirmación del correo con el código de 6 dígitos. Al verificar, el backend emite
/// tokens y entramos directo al panel.
class VerifyEmailScreen extends StatefulWidget {
  const VerifyEmailScreen({super.key, required this.api, required this.email});

  final ApiClient api;
  final String email;

  @override
  State<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends State<VerifyEmailScreen> {
  final _code = TextEditingController();
  bool _loading = false;
  String? _error;

  Timer? _timer;
  int _cooldown = 0;

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    super.dispose();
  }

  void _startCooldown() {
    setState(() => _cooldown = 30);
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      setState(() => _cooldown--);
      if (_cooldown <= 0) t.cancel();
    });
  }

  Future<void> _verify() async {
    if (_code.text.trim().length != 6) {
      setState(() => _error = 'Escribe el código de 6 dígitos.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await widget.api.verifyEmail(email: widget.email, code: _code.text.trim());
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => DashboardScreen(api: widget.api)),
        (r) => false,
      );
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resend() async {
    try {
      await widget.api.resendCode(email: widget.email, purpose: 'VERIFY_EMAIL');
      if (!mounted) return;
      _startCooldown();
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Te enviamos un código nuevo.')));
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Confirma tu correo')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.mark_email_read_outlined, size: 56),
              const SizedBox(height: 16),
              Text('Revisa tu correo',
                  textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Text(
                'Enviamos un código de 6 dígitos a ${widget.email}. Escríbelo aquí para confirmar tu cuenta.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 28),
              TextField(
                controller: _code,
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                maxLength: 6,
                style: const TextStyle(fontSize: 28, letterSpacing: 8, fontWeight: FontWeight.bold),
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(counterText: '', hintText: '••••••'),
                onSubmitted: (_) => _verify(),
              ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(_error!,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _loading ? null : _verify,
                child: _loading
                    ? const SizedBox(
                        height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Confirmar'),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: _cooldown > 0 ? null : _resend,
                child: Text(_cooldown > 0
                    ? 'Reenviar código en $_cooldown s'
                    : '¿No te llegó? Reenviar código'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
