import 'package:get/get.dart';
import 'package:luma_devpost/features/devpost_dashboard/bindings/devpost_dashboard_binding.dart';
import 'package:luma_devpost/features/devpost_dashboard/presentation/pages/devpost_dashboard_page.dart';

part 'app_routes.dart';

class AppPages {
  AppPages._();

  static const INITIAL = Routes.DEVPOST_DASHBOARD;

  static final routes = [
    GetPage(
      name: _Paths.DEVPOST_DASHBOARD,
      page: () => const DevpostDashboardPage(),
      binding: DevpostDashboardBinding(),
    ),
  ];
}
