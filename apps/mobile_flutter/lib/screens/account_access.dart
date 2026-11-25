import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/session.dart';
import '../l10n/app_localizations.dart';
import '../l10n/locale_controller.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({
    super.key,
    required this.session,
    required this.locales,
  });
  final Session session;
  final LocaleController locales;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final form = GlobalKey<FormState>();
  final name = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();
  bool busy = false;
  String? error;

  @override
  void dispose() {
    name.dispose();
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
      await widget.session.register(
        name: name.text.trim(),
        email: email.text.trim(),
        password: password.text,
        locale: widget.locales.locale.languageCode,
      );
      if (mounted) Navigator.pop(context);
    } on ApiException catch (failure) {
      if (mounted) {
        setState(
          () => error = AppLocalizations.of(context).apiError(failure.code),
        );
      }
    } catch (_) {
      if (mounted) {
        setState(() => error = AppLocalizations.of(context).apiError(''));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.createAccount)),
      body: SafeArea(
        child: Form(
          key: form,
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              TextFormField(
                controller: name,
                textCapitalization: TextCapitalization.words,
                decoration: InputDecoration(labelText: l10n.name),
                validator: (value) =>
                    (value ?? '').trim().length < 2 ? l10n.nameRequired : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                decoration: InputDecoration(labelText: l10n.email),
                validator: (value) =>
                    (value ?? '').contains('@') ? null : l10n.emailRequired,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: password,
                obscureText: true,
                autofillHints: const [AutofillHints.newPassword],
                decoration: InputDecoration(
                  labelText: l10n.password,
                  helperText: l10n.passwordHint,
                ),
                validator: (value) =>
                    (value ?? '').length < 10 ? l10n.passwordHint : null,
              ),
              if (error != null) ...[
                const SizedBox(height: 12),
                Text(
                  error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              const SizedBox(height: 20),
              FilledButton(
                onPressed: busy ? null : submit,
                child: Text(busy ? l10n.registering : l10n.createAccount),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final form = GlobalKey<FormState>();
  final email = TextEditingController();
  bool busy = false;
  bool sent = false;
  String? error;

  @override
  void dispose() {
    email.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate() || busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.api.post('/api/auth/request-password-reset', {
        'email': email.text.trim(),
        'redirectTo':
            '/${Localizations.localeOf(context).languageCode}/reset-password',
      });
      if (mounted) setState(() => sent = true);
    } on ApiException catch (failure) {
      if (mounted) {
        setState(
          () => error = AppLocalizations.of(context).apiError(failure.code),
        );
      }
    } catch (_) {
      if (mounted) {
        setState(() => error = AppLocalizations.of(context).apiError(''));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.forgotPassword)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(l10n.forgotLead),
            const SizedBox(height: 16),
            if (sent)
              Text(l10n.resetSent)
            else
              Form(
                key: form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: email,
                      keyboardType: TextInputType.emailAddress,
                      decoration: InputDecoration(labelText: l10n.email),
                      validator: (value) => (value ?? '').contains('@')
                          ? null
                          : l10n.emailRequired,
                    ),
                    if (error != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        error!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: busy ? null : submit,
                      child: Text(busy ? l10n.sendingReset : l10n.sendReset),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ResetPasswordScreen(api: widget.api),
                ),
              ),
              child: Text(l10n.resetPassword),
            ),
          ],
        ),
      ),
    );
  }
}

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final form = GlobalKey<FormState>();
  final token = TextEditingController();
  final password = TextEditingController();
  bool busy = false;
  String? error;

  @override
  void dispose() {
    token.dispose();
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
      await widget.api.post('/api/auth/reset-password', {
        'token': _emailToken(token.text, reset: true),
        'newPassword': password.text,
      });
      if (mounted) Navigator.popUntil(context, (route) => route.isFirst);
    } on ApiException catch (failure) {
      if (mounted) {
        setState(
          () => error = AppLocalizations.of(context).apiError(failure.code),
        );
      }
    } catch (_) {
      if (mounted) {
        setState(() => error = AppLocalizations.of(context).apiError(''));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.resetPassword)),
      body: SafeArea(
        child: Form(
          key: form,
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text(l10n.resetLead),
              const SizedBox(height: 16),
              TextFormField(
                controller: token,
                decoration: InputDecoration(labelText: l10n.resetToken),
                validator: (value) =>
                    _emailToken(value ?? '', reset: true) == null
                        ? l10n.invalidEmailLink
                        : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: password,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: l10n.newPassword,
                  helperText: l10n.passwordHint,
                ),
                validator: (value) =>
                    (value ?? '').length < 10 ? l10n.passwordHint : null,
              ),
              if (error != null) ...[
                const SizedBox(height: 12),
                Text(
                  error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              const SizedBox(height: 20),
              FilledButton(
                onPressed: busy ? null : submit,
                child: Text(busy ? l10n.savingPassword : l10n.savePassword),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String? _emailToken(String input, {required bool reset}) {
  final value = input.trim();
  if (RegExp(r'^[A-Za-z0-9._~-]+$').hasMatch(value)) return value;
  final link = Uri.tryParse(value);
  if (link == null ||
      !link.hasAuthority ||
      link.userInfo.isNotEmpty ||
      !['http', 'https'].contains(link.scheme)) {
    return null;
  }
  // The entered origin is never contacted. Use only the token and let the
  // configured backend validate it, including when a device uses a LAN alias.
  if (reset &&
      link.path.startsWith('/api/auth/reset-password/') &&
      link.pathSegments.length == 4) {
    return link.pathSegments.last;
  }
  if (reset
      ? link.path.endsWith('/reset-password')
      : link.path == '/api/auth/verify-email') {
    final token = link.queryParameters['token'];
    return token == null || token.isEmpty ? null : token;
  }
  return null;
}

class VerifyEmailScreen extends StatefulWidget {
  const VerifyEmailScreen({super.key, required this.session});
  final Session session;

  @override
  State<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends State<VerifyEmailScreen> {
  final form = GlobalKey<FormState>();
  final link = TextEditingController();
  bool busy = false;
  String? message;

  @override
  void dispose() {
    link.dispose();
    super.dispose();
  }

  Future<void> submit({required bool resend}) async {
    if (busy || (!resend && !form.currentState!.validate())) return;
    final session = widget.session;
    final l10n = AppLocalizations.of(context);
    setState(() {
      busy = true;
      message = null;
    });
    try {
      if (resend) {
        await session.api.post('/api/auth/send-verification-email', {
          'email': session.user?['email'],
        });
        if (mounted) setState(() => message = l10n.verificationSent);
        return;
      }
      await session.api.get('/api/auth/verify-email', query: {
        'token': _emailToken(link.text, reset: false)!,
      });
      await session.refresh();
      if (!mounted) return;
      if (session.user?['emailVerified'] == true) {
        Navigator.pop(context);
      } else {
        setState(() => message = l10n.invalidEmailLink);
      }
    } catch (error) {
      if (mounted) {
        setState(() => message = l10n.apiError(
          error is ApiException ? error.code : '',
        ));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.verifyEmail)),
      body: SafeArea(
        child: Form(
          key: form,
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text(l10n.verificationLead),
              const SizedBox(height: 16),
              TextFormField(
                controller: link,
                enabled: !busy,
                keyboardType: TextInputType.url,
                decoration: InputDecoration(labelText: l10n.verifyEmail),
                validator: (value) =>
                    _emailToken(value ?? '', reset: false) == null
                        ? l10n.invalidEmailLink
                        : null,
              ),
              if (message != null) Text(message!),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: busy ? null : () => submit(resend: false),
                child: Text(l10n.verifyEmail),
              ),
              TextButton(
                onPressed: busy ? null : () => submit(resend: true),
                child: Text(l10n.resendVerification),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
