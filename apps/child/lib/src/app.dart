import 'package:childrensafe_shared/childrensafe_shared.dart';
import 'package:flutter/material.dart';

import 'features/pairing/pair_screen.dart';

class ChildApp extends StatelessWidget {
  const ChildApp({super.key, required this.api});

  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ChildrenSafe',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      // El menor empieza emparejando con el código que le da su familia.
      home: PairScreen(api: api),
    );
  }
}
