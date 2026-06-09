import 'package:childrensafe_shared/childrensafe_shared.dart';
import 'package:flutter/material.dart';

import 'src/app.dart';

void main() {
  // Por defecto, el backend público en Render. Para desarrollo local se sobrescribe:
  //   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api
  const fromEnv = String.fromEnvironment('API_BASE_URL');
  const fallback = 'https://childrensafe-api.onrender.com/api';
  final baseUrl = fromEnv.isEmpty ? fallback : fromEnv;

  final api = ApiClient(baseUrl: baseUrl, tokenStore: TokenStore());
  runApp(ChildApp(api: api));
}
