import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:luma_devpost/core/constants/app_constants.dart';
import 'package:luma_devpost/core/constants/support_language.dart';
import 'package:luma_devpost/core/services/storage_service.dart';

class LocaleHelper {
  /// Initialize locale from preferences
  static Future<void> initLocale() async {
    final storage = Get.find<StorageService>();
    final savedLanguage = storage.read<String>(AppConstants.keyLanguage) ?? AppConstants.langEnglish;
    final locale = getLocaleFromLanguage(savedLanguage);
    await initializeDateFormatting(savedLanguage, null);
    Get.updateLocale(locale);
  }

  /// Change app language
  static Future<void> changeLanguage(String language) async {
    final storage = Get.find<StorageService>();
    await storage.write(AppConstants.keyLanguage, language);
    final locale = getLocaleFromLanguage(language);
    await initializeDateFormatting(language, null);
    Get.updateLocale(locale);
  }

  /// Get locale from language code
  static Locale getLocaleFromLanguage(String language) {
    for (final locale in SupportLanguage.supportedLocales) {
      if (locale.languageCode == language) {
        return locale;
      }
    }
    return const Locale('en', 'US');
  }

  /// Get current language code
  static String getCurrentLanguage() {
    return Get.find<StorageService>().read<String>(AppConstants.keyLanguage) ?? AppConstants.langEnglish;
  }
}
