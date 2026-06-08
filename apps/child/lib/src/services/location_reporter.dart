import 'dart:async';

import 'package:battery_plus/battery_plus.dart';
import 'package:childrensafe_shared/childrensafe_shared.dart';
import 'package:geolocator/geolocator.dart';

/// Resultado de preparar el permiso de ubicación, con mensaje apto para el menor.
enum LocationReadiness { ready, serviceOff, denied, deniedForever }

/// Envía la ubicación del menor al backend de forma transparente.
///
/// - Pide permiso de ubicación de forma explícita (la app nunca lo oculta).
/// - Hace un primer envío inmediato y luego se actualiza al moverse (`distanceFilter`).
/// - Es idempotente: cada punto lleva un `clientEventId`, así un reintento no duplica.
class LocationReporter {
  LocationReporter({required this.api, required this.familyId});

  final ApiClient api;
  final String familyId;
  final Battery _battery = Battery();

  StreamSubscription<Position>? _sub;
  bool get isRunning => _sub != null;

  /// Comprueba el servicio y el permiso, solicitándolo si hace falta.
  Future<LocationReadiness> ensurePermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      return LocationReadiness.serviceOff;
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    switch (permission) {
      case LocationPermission.denied:
        return LocationReadiness.denied;
      case LocationPermission.deniedForever:
        return LocationReadiness.deniedForever;
      case LocationPermission.always:
      case LocationPermission.whileInUse:
      case LocationPermission.unableToDetermine:
        return LocationReadiness.ready;
    }
  }

  /// Empieza a compartir: un envío inmediato + actualizaciones al moverse.
  /// Devuelve la disponibilidad; solo arranca el stream si está [LocationReadiness.ready].
  Future<LocationReadiness> start() async {
    final readiness = await ensurePermission();
    if (readiness != LocationReadiness.ready) return readiness;

    await _reportOnce(); // primer punto sin esperar a que se mueva

    _sub ??= Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 25, // metros
      ),
    ).listen((pos) => _send(pos), onError: (_) {/* tolerante a fallos puntuales */});

    return LocationReadiness.ready;
  }

  Future<void> stop() async {
    await _sub?.cancel();
    _sub = null;
  }

  Future<void> _reportOnce() async {
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      await _send(pos);
    } catch (_) {
      // Sin fix todavía; el stream enviará en cuanto haya posición.
    }
  }

  Future<void> _send(Position pos) async {
    int? battery;
    try {
      battery = await _battery.batteryLevel;
    } catch (_) {
      battery = null;
    }
    try {
      await api.reportLocation(
        familyId,
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy,
        batteryLevel: battery,
        clientEventId: 'pt-${pos.timestamp.millisecondsSinceEpoch}',
      );
    } on ApiException {
      // El backend ya normaliza el error; aquí no interrumpimos la app del menor.
    }
  }
}
