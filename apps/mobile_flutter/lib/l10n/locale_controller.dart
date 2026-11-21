import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:material_ui/material_ui.dart';

import 'app_localizations.dart';

class LocaleController extends ChangeNotifier {
  final FlutterSecureStorage storage;
  LocaleController({this.storage = const FlutterSecureStorage()});

  Locale locale = const Locale('en');
  static const _key = 'biletflow_locale';

  Future<void> restore() async {
    try {
      final saved = await storage.read(key: _key);
      if (saved == 'ru' || saved == 'kk' || saved == 'en') {
        locale = Locale(saved!);
        notifyListeners();
      }
    } catch (_) {
      // Keep default English.
    }
  }

  Future<void> setLocale(Locale next) async {
    if (!AppLocalizations.supportedLocales
        .any((item) => item.languageCode == next.languageCode)) {
      return;
    }
    locale = Locale(next.languageCode);
    notifyListeners();
    try {
      await storage.write(key: _key, value: next.languageCode);
    } catch (_) {
      // Preference is still applied for this session.
    }
  }
}
