import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// Smoke test básico. Las pantallas reales dependen de ApiClient (red + secure storage),
// por lo que se prueban con mocks en pruebas dedicadas; aquí solo verificamos el kit de widgets.
void main() {
  testWidgets('renderiza un widget básico', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: Center(child: Text('ChildrenSafe')))),
    );
    expect(find.text('ChildrenSafe'), findsOneWidget);
  });
}
