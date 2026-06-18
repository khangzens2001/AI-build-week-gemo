import 'package:get/get.dart';
import 'package:luma_devpost/core/controllers/app_controller.dart';

class AppBinding extends Bindings {
  @override
  void dependencies() {
    Get.put(AppController());
  }
}
