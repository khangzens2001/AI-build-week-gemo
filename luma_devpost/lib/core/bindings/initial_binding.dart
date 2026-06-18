import 'package:flutter/foundation.dart';
import 'package:get/get.dart';
import 'package:luma_devpost/core/services/firebase_service.dart';
import 'package:luma_devpost/core/services/storage_service.dart';
import 'package:luma_devpost/features/devpost_dashboard/data/services/devpost_scraper_service.dart';

class InitialBinding {
  Future<void> initializeServices() async {
    try {
      // 1. Initialize Firebase (disabled until firebase_options is set up)
      // await FirebaseService.initialize();
      
      // 2. Initialize Storage Service
      await Get.putAsync(() => StorageService().init(), permanent: true);
      
      // Add other service initializations here
      await Get.putAsync(() => DevpostScraperService().init(), permanent: true);
    } catch (e) {
      debugPrint('Failed to initialize services: $e');
      rethrow;
    }
  }
}
