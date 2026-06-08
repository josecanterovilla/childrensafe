import 'dart:io' show Platform;
import 'dart:math';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Identidad del dispositivo del menor para el emparejamiento.
///
/// El `deviceUuid` es un identificador **estable y propio** (no publicitario): se genera
/// una sola vez y se guarda en el almacén seguro del sistema. El nombre y la plataforma
/// se leen de [DeviceInfoPlugin]. El backend exige `deviceUuid` único por dispositivo.
class DeviceIdentity {
  DeviceIdentity([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  static const _kUuid = 'cs_device_uuid';

  /// Devuelve `{ platform, deviceName, deviceUuid }` listo para `joinFamily`.
  Future<Map<String, dynamic>> describe() async {
    return {
      'platform': Platform.isIOS ? 'IOS' : 'ANDROID',
      'deviceName': await _deviceName(),
      'deviceUuid': await _stableUuid(),
    };
  }

  Future<String> _deviceName() async {
    final info = DeviceInfoPlugin();
    try {
      if (Platform.isAndroid) {
        final a = await info.androidInfo;
        return '${a.manufacturer} ${a.model}'.trim();
      }
      if (Platform.isIOS) {
        final i = await info.iosInfo;
        return i.name; // p. ej. "iPhone de Lucía"
      }
    } catch (_) {
      // Si la plataforma no expone la info, seguimos con un nombre genérico.
    }
    return 'Mi teléfono';
  }

  /// Lee el UUID persistido o genera uno nuevo (UUID v4) la primera vez.
  Future<String> _stableUuid() async {
    final existing = await _storage.read(key: _kUuid);
    if (existing != null && existing.isNotEmpty) return existing;
    final fresh = _uuidV4();
    await _storage.write(key: _kUuid, value: fresh);
    return fresh;
  }

  static String _uuidV4() {
    final rnd = Random.secure();
    final bytes = List<int>.generate(16, (_) => rnd.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // versión 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante 10xx
    String hex(int b) => b.toRadixString(16).padLeft(2, '0');
    final h = bytes.map(hex).join();
    return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}'
        '-${h.substring(16, 20)}-${h.substring(20)}';
  }
}
