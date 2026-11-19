import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'core/api.dart';
import 'core/session.dart';
import 'screens/login.dart';
import 'screens/home.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  const url = String.fromEnvironment('BILETFLOW_API_URL', defaultValue: 'http://10.0.2.2:3000');
  final session = Session(ApiClient(url));
  runApp(BiletFlowApp(session: session));
  session.restore();
}

class BiletFlowApp extends StatelessWidget {
  final Session session;
  const BiletFlowApp({super.key, required this.session});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'BiletFlow', debugShowCheckedModeBanner: false,
    theme: ThemeData(useMaterial3: true, colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff6950b7)), scaffoldBackgroundColor: const Color(0xfff8f7fb), inputDecorationTheme: const InputDecorationTheme(border: OutlineInputBorder())),
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    supportedLocales: const [Locale('en'), Locale('ru'), Locale('kk')],
    home: ListenableBuilder(listenable: session, builder: (context, _) {
      if (session.loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
      return session.user == null ? LoginScreen(session: session) : HomeScreen(session: session);
    }),
  );
}
