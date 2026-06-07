/// Modelos de dominio (espejo de las respuestas del backend). Inmutables y sin lógica de UI.

enum MemberRole { parent, guardian, child, unknown }

MemberRole memberRoleFrom(String? v) => switch (v) {
      'PARENT' => MemberRole.parent,
      'GUARDIAN' => MemberRole.guardian,
      'CHILD' => MemberRole.child,
      _ => MemberRole.unknown,
    };

class FamilySummary {
  const FamilySummary({required this.familyId, required this.name, required this.role});

  factory FamilySummary.fromJson(Map<String, dynamic> j) => FamilySummary(
        familyId: j['familyId'] as String,
        name: j['name'] as String,
        role: memberRoleFrom(j['role'] as String?),
      );

  final String familyId;
  final String name;
  final MemberRole role;
}

class ChildProfile {
  const ChildProfile({
    required this.id,
    required this.displayName,
    required this.ageBand,
  });

  factory ChildProfile.fromJson(Map<String, dynamic> j) => ChildProfile(
        id: j['id'] as String,
        displayName: j['displayName'] as String,
        ageBand: j['ageBand'] as String? ?? 'CHILD',
      );

  final String id;
  final String displayName;
  final String ageBand;
}

enum AlertSeverity { info, warning, critical }

AlertSeverity severityFrom(String? v) => switch (v) {
      'CRITICAL' => AlertSeverity.critical,
      'WARNING' => AlertSeverity.warning,
      _ => AlertSeverity.info,
    };

class AlertItem {
  const AlertItem({
    required this.id,
    required this.type,
    required this.severity,
    required this.title,
    required this.message,
    required this.createdAt,
  });

  factory AlertItem.fromJson(Map<String, dynamic> j) => AlertItem(
        id: j['id'] as String,
        type: j['type'] as String,
        severity: severityFrom(j['severity'] as String?),
        title: j['title'] as String,
        message: j['message'] as String,
        createdAt: DateTime.tryParse(j['createdAt'] as String? ?? '') ?? DateTime.now(),
      );

  final String id;
  final String type;
  final AlertSeverity severity;
  final String title;
  final String message;
  final DateTime createdAt;
}

class LocationPoint {
  const LocationPoint({
    required this.latitude,
    required this.longitude,
    this.accuracy,
    this.batteryLevel,
    required this.recordedAt,
  });

  factory LocationPoint.fromJson(Map<String, dynamic> j) => LocationPoint(
        latitude: (j['latitude'] as num).toDouble(),
        longitude: (j['longitude'] as num).toDouble(),
        accuracy: (j['accuracy'] as num?)?.toDouble(),
        batteryLevel: j['batteryLevel'] as int?,
        recordedAt: DateTime.tryParse(j['recordedAt'] as String? ?? '') ?? DateTime.now(),
      );

  final double latitude;
  final double longitude;
  final double? accuracy;
  final int? batteryLevel;
  final DateTime recordedAt;
}
