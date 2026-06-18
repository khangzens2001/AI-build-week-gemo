import 'package:get/get.dart';
import 'package:luma_devpost/features/devpost_dashboard/presentation/controllers/devpost_dashboard_controller.dart';

class DevpostDashboardBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<DevpostDashboardController>(
      () => DevpostDashboardController(),
    );
  }
}
