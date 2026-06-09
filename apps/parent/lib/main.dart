import 'package:childrensafe_shared/childrensafe_shared.dart';
import 'package:flutter/material.dart';

import 'src/app.dart';

void main() {
  // Por defecto, el backend público en Render (así los APK funcionan sin depender de que la
  // variable esté bien puesta en CI). Para desarrollo local se sobrescribe en build/run:
  //   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api
  const fromEnv = String.fromEnvironment('API_BASE_URL');
  const fallback = 'https://childrensafe-api.onrender.com/api';
  final baseUrl = fromEnv.isEmpty ? fallback : fromEnv;

  final api = ApiClient(baseUrl: baseUrl, tokenStore: TokenStore());
  runApp(ParentApp(api: api));
}
