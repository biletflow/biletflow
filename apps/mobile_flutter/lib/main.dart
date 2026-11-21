import 'package:material_ui/material_ui.dart';
import 'core/api.dart';
import 'core/session.dart';
import 'l10n/app_localizations.dart';
import 'l10n/locale_controller.dart';
import 'screens/login.dart';
import 'screens/home.dart';
import 'theme/biletflow_theme.dart';
import 'widgets/empty_state.dart';

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
          theme: biletFlowTheme(),
          home: ListenableBuilder(
            listenable: session,
            builder: (context, _) {
              if (session.loading) {
                return const Scaffold(body: LoadingState());
              }
              return session.user == null
                  ? LoginScreen(session: session, locales: locales)
                  : HomeScreen(session: session, locales: locales);
            },
          ),
        ),
      );
}
