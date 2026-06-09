import 'dart:async';

import 'package:childrensafe_shared/childrensafe_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Paso 2 de recuperación: el usuario introduce el código recibido y su nueva contraseña.
/// Al cambiarla, vuelve al login.
class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key, required this.api, required this.email});

  final ApiClient api;
  final String email;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _code = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _loading = false;
  String? _error;

  Timer? _timer;
  int _cooldown = 0;

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    _password.dispose();
    _confirm.dispose();
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

  String? _validate() {
    if (_code.text.trim().length != 6) return 'Escribe el código de 6 dígitos.';
    if (_password.text.length < 10) {
      return 'La contraseña debe tener al menos 10 caracteres.';
    }
    if (_password.text != _confirm.text) return 'Las contraseñas no coinciden.';
    return null;
  }

  Future<void> _submit() async {
    final problem = _validate();
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final messenger = ScaffoldMessenger.of(context);
    try {
      await widget.api.resetPassword(
        email: widget.email,
        code: _code.text.trim(),
        newPassword: _password.text,
      );
      messenger.showSnackBar(
        const SnackBar(content: Text('Contraseña actualizada. Ya puedes iniciar sesión.')),
      );
      if (mounted) Navigator.of(context).popUntil((r) => r.isFirst);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resend() async {
    try {
      await widget.api.resendCode(email: widget.email, purpose: 'PASSWORD_RESET');
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
      appBar: AppBar(title: const Text('Nueva contraseña')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Escribe el código que enviamos a ${widget.email} y tu nueva contraseña.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _code,
                keyboardType: TextInputType.number,
                maxLength: 6,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(labelText: 'Código de 6 dígitos', counterText: ''),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _password,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Nueva contraseña',
                  helperText: 'Mínimo 10 caracteres',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _confirm,
                obscureText: true,
                onSubmitted: (_) => _submit(),
                decoration: const InputDecoration(labelText: 'Repetir contraseña'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const SizedBox(
                        height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Cambiar contraseña'),
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
