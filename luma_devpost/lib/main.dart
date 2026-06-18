import 'package:luma_devpost/app.dart';
import 'package:luma_devpost/core/bindings/initial_binding.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Services
  await InitialBinding().initializeServices();
  
  _hideSystemUI();
  runApp(const App());
}

void _hideSystemUI() {
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarBrightness: Brightness.light,
      systemStatusBarContrastEnforced: true,
    ),
  );

  SystemChrome.setPreferredOrientations(<DeviceOrientation>[
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  SystemChrome.setSystemUIChangeCallback((systemOverlaysAreVisible) async {
    if (systemOverlaysAreVisible) {
      await Future.delayed(const Duration(seconds: 3));
      SystemChrome.restoreSystemUIOverlays();
    }
  });
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.manual, overlays: []);
}
