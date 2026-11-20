import 'package:material_ui/material_ui.dart';
import 'core/api.dart';
import 'core/session.dart';
import 'l10n/app_localizations.dart';
import 'l10n/locale_controller.dart';
import 'screens/login.dart';
import 'screens/home.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  const url = String.fromEnvironment('BILETFLOW_API_URL', defaultValue: 'http://10.0.2.2:3000');
  final session = Session(ApiClient(url));
  final locales = LocaleController();
  runApp(BiletFlowApp(session: session, locales: locales));
  locales.restore();
  session.restore();
}

class BiletFlowApp extends StatelessWidget {
  final Session session;
  final LocaleController locales;
  const BiletFlowApp({super.key, required this.session, required this.locales});
  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: locales,
        builder: (context, _) => MaterialApp(
          title: 'BiletFlow',
          debugShowCheckedModeBanner: false,
          locale: locales.locale,
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: [
            AppLocalizations.delegate,
            ...GlobalMaterialLocalizations.delegates,
          ],
          theme: ThemeData(
            useMaterial3: true,
            colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff6950b7)),
            scaffoldBackgroundColor: const Color(0xfff8f7fb),
            inputDecorationTheme: const InputDecorationTheme(border: OutlineInputBorder()),
          ),
          home: ListenableBuilder(
            listenable: session,
            builder: (context, _) {
              if (session.loading) {
                return const Scaffold(body: Center(child: CircularProgressIndicator()));
              }
              return session.user == null
                  ? LoginScreen(session: session, locales: locales)
                  : HomeScreen(session: session, locales: locales);
            },
          ),
        ),
      );
}
