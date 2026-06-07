import 'package:dio/dio.dart';

import '../storage/token_store.dart';
import 'api_exception.dart';

/// Cliente HTTP de ChildrenSafe.
///
/// Responsabilidades:
///  - adjuntar el access token a cada petición;
///  - renovar automáticamente con el refresh token ante un 401 (tolerancia a expiración);
///  - normalizar errores a [ApiException] con mensajes aptos para el usuario.
///
/// Toda la lógica de red vive aquí (separada de la interfaz). Las pantallas solo invocan
/// métodos de alto nivel.
class ApiClient {
  ApiClient({required String baseUrl, required TokenStore tokenStore})
      : _tokens = tokenStore,
        _dio = Dio(BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 15),
          headers: {'Content-Type': 'application/json'},
        )) {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _tokens.accessToken;
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        // Renueva una sola vez ante 401, luego reintenta la petición original.
        if (error.response?.statusCode == 401 && !_isAuthPath(error.requestOptions.path)) {
          final refreshed = await _tryRefresh();
          if (refreshed) {
            final retried = await _retry(error.requestOptions);
            return handler.resolve(retried);
          }
        }
        handler.next(error);
      },
    ));
  }

  final Dio _dio;
  final TokenStore _tokens;
  Future<bool>? _refreshing;

  bool _isAuthPath(String path) => path.contains('/auth/');

  // ───────────────────────── Auth ─────────────────────────

  Future<void> register({
    required String email,
    required String password,
    required String displayName,
    String? familyName,
  }) async {
    final res = await _post('/auth/register', {
      'email': email,
      'password': password,
      'displayName': displayName,
      if (familyName != null) 'familyName': familyName,
    });
    await _saveTokens(res);
  }

  Future<void> login({
    required String email,
    required String password,
    String? mfaCode,
  }) async {
    final res = await _post('/auth/login', {
      'email': email,
      'password': password,
      if (mfaCode != null) 'mfaCode': mfaCode,
    });
    await _saveTokens(res);
  }

  /// Inicia sesión con Google enviando el ID token al backend, que crea o enlaza la cuenta.
  Future<void> loginWithGoogle(String idToken) async {
    final res = await _post('/auth/google', {'idToken': idToken});
    await _saveTokens(res);
  }

  Future<void> logout() async {
    final refresh = await _tokens.refreshToken;
    if (refresh != null) {
      try {
        await _post('/auth/logout', {'refreshToken': refresh});
      } catch (_) {
        // Aunque falle en el servidor, limpiamos local.
      }
    }
    await _tokens.clear();
  }

  // ───────────────────────── Familias ─────────────────────

  Future<List<dynamic>> listFamilies() async => _get('/families') as List<dynamic>;

  Future<Map<String, dynamic>> getFamily(String familyId) async =>
      _get('/families/$familyId') as Map<String, dynamic>;

  // ───────────────────────── Emparejamiento ───────────────

  /// (Tutor) Genera un código. Devuelve { code, qrPayload, expiresAt }.
  Future<Map<String, dynamic>> createPairingCode(
    String familyId, {
    required String childDisplayName,
    required String childAgeBand,
  }) async {
    return _post('/families/$familyId/pairing-codes', {
      'childDisplayName': childDisplayName,
      'childAgeBand': childAgeBand,
    });
  }

  /// (Menor) Canjea un código y guarda los tokens del dispositivo del menor.
  Future<Map<String, dynamic>> joinFamily({
    required String code,
    String? displayName,
    required Map<String, dynamic> device,
  }) async {
    final res = await _post('/pairing/join', {
      'code': code,
      if (displayName != null) 'displayName': displayName,
      'device': device,
    });
    await _saveTokens(res);
    return res;
  }

  // ───────────────────────── Ubicación / SOS ──────────────

  Future<void> reportLocation(
    String familyId, {
    required double latitude,
    required double longitude,
    double? accuracy,
    int? batteryLevel,
    String? clientEventId,
  }) async {
    await _post('/families/$familyId/location', {
      'latitude': latitude,
      'longitude': longitude,
      if (accuracy != null) 'accuracy': accuracy,
      if (batteryLevel != null) 'batteryLevel': batteryLevel,
      if (clientEventId != null) 'clientEventId': clientEventId,
    });
  }

  Future<Map<String, dynamic>> latestLocation(String familyId, String childId) async =>
      _get('/families/$familyId/children/$childId/location/latest') as Map<String, dynamic>;

  Future<List<dynamic>> listAlerts(String familyId, {String? status}) async =>
      _get('/families/$familyId/alerts${status != null ? '?status=$status' : ''}')
          as List<dynamic>;

  Future<void> triggerSos(
    String familyId, {
    double? latitude,
    double? longitude,
    int? batteryLevel,
    String? message,
  }) async {
    await _post('/families/$familyId/sos', {
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (batteryLevel != null) 'batteryLevel': batteryLevel,
      if (message != null) 'message': message,
    });
  }

  Future<void> arrived(String familyId, {String? place}) async {
    await _post('/families/$familyId/arrived', {if (place != null) 'place': place});
  }

  // ───────────────────────── Internos ─────────────────────

  Future<dynamic> _get(String path) async {
    try {
      final res = await _dio.get<dynamic>(path);
      return res.data;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body) async {
    try {
      final res = await _dio.post<dynamic>(path, data: body);
      return (res.data as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<void> _saveTokens(Map<String, dynamic> res) async {
    final access = res['accessToken'] as String?;
    final refresh = res['refreshToken'] as String?;
    if (access != null && refresh != null) {
      await _tokens.save(access: access, refresh: refresh);
    }
  }

  Future<bool> _tryRefresh() {
    // Single-flight: si ya hay un refresh en curso, espera el mismo resultado.
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<bool> _doRefresh() async {
    final refresh = await _tokens.refreshToken;
    if (refresh == null) return false;
    try {
      final res = await _dio.post<dynamic>('/auth/refresh', data: {'refreshToken': refresh});
      final data = (res.data as Map).cast<String, dynamic>();
      await _tokens.save(
        access: data['accessToken'] as String,
        refresh: data['refreshToken'] as String,
      );
      return true;
    } on DioException {
      await _tokens.clear();
      return false;
    }
  }

  Future<Response<dynamic>> _retry(RequestOptions options) async {
    final token = await _tokens.accessToken;
    final opts = Options(method: options.method, headers: {
      ...options.headers,
      if (token != null) 'Authorization': 'Bearer $token',
    });
    return _dio.request<dynamic>(
      options.path,
      data: options.data,
      queryParameters: options.queryParameters,
      options: opts,
    );
  }

  ApiException _toApiException(DioException e) {
    final data = e.response?.data;
    String message = 'No pudimos completar la acción. Revisa tu conexión e inténtalo de nuevo.';
    if (data is Map && data['message'] != null) {
      final m = data['message'];
      message = m is List ? m.join('\n') : m.toString();
    } else if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout) {
      message = 'Sin conexión con el servidor.';
    }
    return ApiException(message, statusCode: e.response?.statusCode);
  }
}
