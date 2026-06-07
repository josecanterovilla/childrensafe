import 'package:childrensafe_shared/childrensafe_shared.dart';
import 'package:flutter/material.dart';

import 'src/app.dart';

void main() {
  const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000/api',
  );

  final api = ApiClient(baseUrl: baseUrl, tokenStore: TokenStore());
  runApp(ChildApp(api: api));
}
