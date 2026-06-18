import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:luma_devpost/firebase_options.dart';

class FirebaseService {
  static Future<void> initialize() async {
    try {
      /// Init Firebase App
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
      initCrashlytics();
    } catch (e) {
      debugPrint('Firebase init error: $e');
    }
  }

  static void initCrashlytics() {
    if (kDebugMode) {
      FirebaseCrashlytics.instance.setCrashlyticsCollectionEnabled(false);
    } else {
      FirebaseCrashlytics.instance.setCrashlyticsCollectionEnabled(true);
    }
  }

  static Future<void> logEvent({required String eventName, Map<String, Object>? parameters}) async {
    debugPrint('event: $eventName | $parameters');
    if (kDebugMode) return;
    try {
      FirebaseAnalytics.instance.logEvent(name: eventName, parameters: parameters);
    } catch (_) {}
  }

  static Future<void> logScreenView({
    required String screenName,
    required String screenClass,
  }) async {
    debugPrint('screenView: $screenName | $screenClass');
    if (kDebugMode) return;
    try {
      FirebaseAnalytics.instance.logScreenView(screenClass: screenClass, screenName: screenName);
    } catch (_) {}
  }
}
