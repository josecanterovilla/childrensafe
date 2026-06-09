import 'package:childrensafe_shared/childrensafe_shared.dart';
import 'package:flutter/material.dart';

import 'verify_email_screen.dart';

/// Crear cuenta de tutor: nombre, correo y contraseña (con confirmación).
/// Al registrar, el backend envía un código al correo y pasamos a confirmarlo.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  String? _validate() {
    if (_name.text.trim().isEmpty) return 'Escribe tu nombre.';
    final email = _email.text.trim();
    if (!email.contains('@') || !email.contains('.')) return 'Escribe un correo válido.';
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
    try {
      final email = _email.text.trim();
      await widget.api.register(
        email: email,
        password: _password.text,
        displayName: _name.text.trim(),
      );
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(
        builder: (_) => VerifyEmailScreen(api: widget.api, email: email),
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
      appBar: AppBar(title: const Text('Crear cuenta')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Tus datos', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
              Text(
                'Crea tu cuenta de tutor. Te enviaremos un código al correo para confirmarla.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'Tu nombre'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                decoration: const InputDecoration(labelText: 'Correo'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _password,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Contraseña',
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
                    : const Text('Crear cuenta'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
