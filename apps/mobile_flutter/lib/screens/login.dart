import 'package:material_ui/material_ui.dart';
import '../core/session.dart';
import '../l10n/app_localizations.dart';
import '../l10n/locale_controller.dart';
import '../widgets/locale_switcher.dart';

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
    } catch (e) {
      if (mounted) {
        final l10n = AppLocalizations.of(context);
        setState(() => error = l10n.apiError('$e'));
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
        actions: [LocaleSwitcher(controller: widget.locales)],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Form(
                key: form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Icon(Icons.confirmation_number_outlined,
                        size: 48, color: Theme.of(context).colorScheme.primary),
                    Text(l10n.appName,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.headlineLarge),
                    const SizedBox(height: 32),
                    TextFormField(
                      controller: email,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      decoration: InputDecoration(labelText: l10n.email),
                      validator: (v) =>
                          (v ?? '').contains('@') ? null : l10n.emailRequired,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: password,
                      obscureText: true,
                      autofillHints: const [AutofillHints.password],
                      decoration: InputDecoration(labelText: l10n.password),
                      validator: (v) =>
                          (v ?? '').isEmpty ? l10n.passwordRequired : null,
                      onFieldSubmitted: (_) => submit(),
                    ),
                    const SizedBox(height: 20),
                    if (error != null || widget.session.error != null)
                      Text(
                        error ??
                            AppLocalizations.of(context)
                                .apiError(widget.session.error ?? ''),
                        style: TextStyle(color: Theme.of(context).colorScheme.error),
                      ),
                    FilledButton(
                      onPressed: busy ? null : submit,
                      child: Text(busy ? l10n.signingIn : l10n.signIn),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
