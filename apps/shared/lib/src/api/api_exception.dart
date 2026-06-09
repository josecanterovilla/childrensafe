/// Error normalizado de la API, con mensaje apto para mostrar al usuario.
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.code});

  final String message;
  final int? statusCode;

  /// Código de aplicación opcional del backend (p. ej. 'EMAIL_NOT_VERIFIED').
  final String? code;

  @override
  String toString() => 'ApiException($statusCode, $code): $message';
}
