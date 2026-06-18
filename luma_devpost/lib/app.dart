import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:get/get.dart';
import 'package:luma_devpost/core/bindings/app_binding.dart';
import 'package:luma_devpost/core/constants/support_language.dart';
import 'package:luma_devpost/core/translations/app_translations.dart';
import 'package:luma_devpost/core/routes/app_pages.dart';

class App extends StatefulWidget {
  const App({super.key});

  @override
  State<App> createState() => AppState();
}

class AppState extends State<App> with WidgetsBindingObserver {
  // final languageCtrl = Get.put(LanguageController());

  @override
  void initState() {
    WidgetsBinding.instance.addObserver(this);
    super.initState();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // if (_state == AppLifecycleState.paused) {}
    } else if (state == AppLifecycleState.paused) {}
    super.didChangeAppLifecycleState(state);
  }

  @override
  Widget build(BuildContext context) {
    return GetMaterialApp(
      initialBinding: AppBinding(),
      initialRoute: AppPages.INITIAL, // Ensure this maps to a valid route
      getPages: AppPages.routes,
      navigatorKey: Get.key,
      // locale: Locale(languageCtrl.currentLanguage.value),
      translations: AppTranslations(),
      title: "App Name", // GlobalConstants.kAppName
      supportedLocales: SupportLanguage.supportedLocales,
      theme: ThemeData.light(), // MTheme.light
      darkTheme: ThemeData.dark(), // MTheme.dark
      // themeMode: StorageService.to.isDarkMode ? ThemeMode.dark : ThemeMode.light,
      debugShowCheckedModeBanner: false,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      // fallbackLocale: LanguageUtil.fallbackLocale,
    );
  }
}
