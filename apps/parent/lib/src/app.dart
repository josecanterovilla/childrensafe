import 'package:childrensafe_shared/childrensafe_shared.dart';
import 'package:flutter/material.dart';

import 'features/auth/login_screen.dart';

class ParentApp extends StatelessWidget {
  const ParentApp({super.key, required this.api});

  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ChildrenSafe',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      home: LoginScreen(api: api),
    );
  }
}
