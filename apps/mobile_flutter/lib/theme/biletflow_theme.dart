import 'package:material_ui/material_ui.dart';

/// Brand tokens mirrored from the web Figma design system (`globals.css`).
abstract final class BiletFlowColors {
  static const brand = Color(0xff4622ba);
  static const brandDark = Color(0xff3a1a9e);
  static const brandLight = Color(0xff6040cc);
  static const brandTint = Color(0xffede8ff);
  static const brandUltralight = Color(0xfff7f4ff);
  static const sky = Color(0xff80d6e9);

  static const success = Color(0xff10b981);
  static const successBg = Color(0xffecfdf5);
  static const warning = Color(0xfff59e0b);
  static const warningBg = Color(0xfffffbeb);
  static const error = Color(0xffef4444);
  static const errorBg = Color(0xfffef2f2);
  static const info = Color(0xff3b82f6);
  static const infoBg = Color(0xffeff6ff);

  static const ink900 = Color(0xff0f0f1a);
  static const ink800 = Color(0xff1f2937);
  static const ink700 = Color(0xff374151);
  static const ink600 = Color(0xff6b7280);
  static const ink300 = Color(0xffe5e7eb);
  static const ink100 = Color(0xfff9fafb);
  static const hero = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [brand, brandDark],
  );
}

ThemeData biletFlowTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: BiletFlowColors.brand,
    primary: BiletFlowColors.brand,
    secondary: BiletFlowColors.brandLight,
    surface: Colors.white,
    error: BiletFlowColors.error,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: BiletFlowColors.ink100,
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: BiletFlowColors.ink900,
      titleTextStyle: TextStyle(
        color: BiletFlowColors.ink900,
        fontSize: 19,
        fontWeight: FontWeight.w700,
      ),
      elevation: 0,
      scrolledUnderElevation: 0,
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      margin: const EdgeInsets.symmetric(vertical: 4),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: BiletFlowColors.ink300),
      ),
    ),
    textTheme:
        const TextTheme(
          headlineLarge: TextStyle(
            fontSize: 34,
            height: 1.08,
            fontWeight: FontWeight.w800,
          ),
          headlineSmall: TextStyle(
            fontSize: 24,
            height: 1.2,
            fontWeight: FontWeight.w800,
          ),
          titleLarge: TextStyle(
            fontSize: 20,
            height: 1.25,
            fontWeight: FontWeight.w700,
          ),
          titleMedium: TextStyle(
            fontSize: 16,
            height: 1.25,
            fontWeight: FontWeight.w700,
          ),
          bodyMedium: TextStyle(fontSize: 14, height: 1.45),
        ).apply(
          bodyColor: BiletFlowColors.ink900,
          displayColor: BiletFlowColors.ink900,
        ),
    navigationBarTheme: const NavigationBarThemeData(
      elevation: 0,
      backgroundColor: Colors.white,
      indicatorColor: BiletFlowColors.brandTint,
      labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: BiletFlowColors.brand,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: BiletFlowColors.brand,
        minimumSize: const Size.fromHeight(48),
        side: const BorderSide(color: BiletFlowColors.ink300),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: BiletFlowColors.ink300),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: BiletFlowColors.ink300),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: BiletFlowColors.brand, width: 2),
      ),
    ),
    listTileTheme: const ListTileThemeData(
      iconColor: BiletFlowColors.brand,
      textColor: BiletFlowColors.ink900,
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: BiletFlowColors.brand,
    ),
  );
}
