import 'package:flutter/material.dart';

class AppConstants {
  // App Information
  static const String appName = 'App Name';

  // Storage Keys
  static const String keyFirstOpenApp = 'first_open_app';
  static const String keyLanguage = 'language';

  // Supported Languages
  static const String langEnglish = 'en';
  static const String langVietnamese = 'vi';

  // List of all supported languages
  static const List<String> supportedLanguages = [
    langEnglish,
    langVietnamese,
  ];

}
