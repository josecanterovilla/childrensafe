import 'package:childrensafe_shared/childrensafe_shared.dart';
import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../dashboard/dashboard_screen.dart';

/// Pantalla de inicio de sesión del tutor. La lógica de red está en [ApiClient];
/// aquí solo se gestiona el estado local del formulario y la navegación.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await widget.api.login(email: _email.text.trim(), password: _password.text);
      _goToDashboard();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Inicio con Google: obtiene el ID token y lo entrega al backend (crea/enlaza la cuenta).
  /// El Web Client ID se inyecta en build con --dart-define=GOOGLE_SERVER_CLIENT_ID=...
  Future<void> _google() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      const serverClientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');
      final googleSignIn = GoogleSignIn(
        scopes: const ['email'],
        serverClientId: serverClientId.isEmpty ? null : serverClientId,
      );
      final account = await googleSignIn.signIn();
      if (account == null) return; // el usuario canceló
      final auth = await account.authentication;
      final idToken = auth.idToken;
      if (idToken == null) {
        setState(() => _error =
            'No se obtuvo el token de Google. Revisa la configuración OAuth (GOOGLE_SERVER_CLIENT_ID y SHA-1).');
        return;
      }
      await widget.api.loginWithGoogle(idToken);
      _goToDashboard();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'No se pudo iniciar con Google.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _goToDashboard() {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => DashboardScreen(api: widget.api)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.shield_outlined, size: 56),
                const SizedBox(height: 16),
                Text('ChildrenSafe',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 4),
                Text('Protección con transparencia',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 32),
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'Correo'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _password,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Contraseña'),
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
                      : const Text('Entrar'),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    const Expanded(child: Divider()),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Text('o', style: Theme.of(context).textTheme.bodySmall),
                    ),
                    const Expanded(child: Divider()),
                  ],
                ),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: _loading ? null : _google,
                  icon: const Icon(Icons.account_circle_outlined),
                  label: const Text('Continuar con Google'),
                  style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
