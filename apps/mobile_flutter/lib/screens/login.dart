import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/session.dart';
import '../l10n/app_localizations.dart';
import '../l10n/locale_controller.dart';
import '../widgets/brand_mark.dart';
import '../widgets/locale_switcher.dart';
import 'account_access.dart';

class LoginScreen extends StatefulWidget {
  final Session session;
  final LocaleController locales;
  const LoginScreen({super.key, required this.session, required this.locales});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  final form = GlobalKey<FormState>();
  bool busy = false;
  String? error;

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate() || busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.session.login(email.text.trim(), password.text);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => error = e.code);
      }
    } catch (_) {
      if (mounted) {
        setState(() => error = 'REQUEST_FAILED');
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const BrandMark(),
        actions: [LocaleSwitcher(controller: widget.locales)],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: AutofillGroup(
                    child: Form(
                      key: form,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            l10n.welcomeBack,
                            style: Theme.of(context).textTheme.headlineSmall,
                          ),
                          const SizedBox(height: 32),
                          TextFormField(
                            controller: email,
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            autofillHints: const [AutofillHints.email],
                            decoration: InputDecoration(labelText: l10n.email),
                            validator: (v) => (v ?? '').contains('@')
                                ? null
                                : l10n.emailRequired,
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: password,
                            obscureText: true,
                            autofillHints: const [AutofillHints.password],
                            decoration: InputDecoration(
                              labelText: l10n.password,
                            ),
                            validator: (v) => (v ?? '').isEmpty
                                ? l10n.passwordRequired
                                : null,
                            onFieldSubmitted: (_) => submit(),
                          ),
                          const SizedBox(height: 20),
                          if (error != null || widget.session.error != null)
                            Text(
                              l10n.apiError(
                                error ?? widget.session.error ?? '',
                              ),
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.error,
                              ),
                            ),
                          FilledButton(
                            onPressed: busy ? null : submit,
                            child: Text(busy ? l10n.signingIn : l10n.signIn),
                          ),
                          TextButton(
                            onPressed: busy
                                ? null
                                : () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => ForgotPasswordScreen(
                                        api: widget.session.api,
                                      ),
                                    ),
                                  ),
                            child: Text(l10n.forgotPassword),
                          ),
                          TextButton(
                            onPressed: busy
                                ? null
                                : () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => RegisterScreen(
                                        session: widget.session,
                                        locales: widget.locales,
                                      ),
                                    ),
                                  ),
                            child: Text(l10n.createAccount),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
