import 'package:get/get.dart';
import 'package:luma_devpost/features/devpost_dashboard/data/models/devpost_info_model.dart';
import 'package:luma_devpost/features/devpost_dashboard/data/services/devpost_scraper_service.dart';

class DevpostDashboardController extends GetxController {
  final DevpostScraperService _scraperService = Get.find<DevpostScraperService>();

  final RxBool isLoading = false.obs; // Màn hình chính không khóa loading toàn bộ
  final RxMap<String, bool> pageLoading = <String, bool>{
    'Home': false,
    'Resources': false,
    'Updates': false,
    'Rules': false,
    'Project Gallery': false,
  }.obs;

  late final Rx<DevpostInfoModel> devpostInfo;
  final RxString statusMessage = ''.obs;

  final RxSet<String> failedPages = <String>{}.obs;

  @override
  void onInit() {
    super.onInit();
    devpostInfo = DevpostInfoModel(
      homePage: DevpostPageContent(
        title: 'Home',
        url: DevpostScraperService.baseUrl,
        markdownContent: '',
      ),
      resourcesPage: DevpostPageContent(
        title: 'Resources',
        url: '${DevpostScraperService.baseUrl}/resources',
        markdownContent: '',
      ),
      updatesPage: DevpostPageContent(
        title: 'Updates',
        url: '${DevpostScraperService.baseUrl}/updates',
        markdownContent: '',
      ),
      rulesPage: DevpostPageContent(
        title: 'Rules',
        url: '${DevpostScraperService.baseUrl}/rules',
        markdownContent: '',
      ),
      projectGalleryPage: DevpostPageContent(
        title: 'Project Gallery',
        url: '${DevpostScraperService.baseUrl}/project-gallery',
        markdownContent: '',
      ),
    ).obs;
    fetchData();
  }

  Future<void> refreshData() async {
    // Nếu có trang bị lỗi hoặc trống, chỉ cào lại các trang lỗi đó.
    // Nếu không có lỗi nào, cào lại toàn bộ.
    final hasFailed = failedPages.isNotEmpty ||
        devpostInfo.value.homePage.markdownContent.isEmpty ||
        devpostInfo.value.resourcesPage.markdownContent.isEmpty ||
        devpostInfo.value.updatesPage.markdownContent.isEmpty ||
        devpostInfo.value.rulesPage.markdownContent.isEmpty ||
        devpostInfo.value.projectGalleryPage.markdownContent.isEmpty;

    await fetchData(onlyFailed: hasFailed);
  }

  Future<void> fetchData({bool onlyFailed = false}) async {
    statusMessage.value = onlyFailed ? 'Đang thử lại các trang lỗi...' : 'Fetching data from Devpost...';

    Future<void> fetchOne(
      String url,
      String title,
      void Function(DevpostPageContent) updateFunc,
    ) async {
      pageLoading[title] = true;
      failedPages.remove(title);
      try {
        final page = await _scraperService.fetchPage(url, title);
        if (page != null) {
          updateFunc(page);
        } else {
          failedPages.add(title);
          updateFunc(
            DevpostPageContent(
              title: title,
              url: url,
              markdownContent: 'Chặn bởi bảo mật AWS WAF. Vui lòng kiểm tra lại proxy.',
            ),
          );
        }
      } catch (e) {
        failedPages.add(title);
        updateFunc(
          DevpostPageContent(
            title: title,
            url: url,
            markdownContent: 'Lỗi: $e',
          ),
        );
      } finally {
        pageLoading[title] = false;
      }
    }

    final List<Future<void>> tasks = [];

    if (!onlyFailed || failedPages.contains('Home') || devpostInfo.value.homePage.markdownContent.isEmpty) {
      tasks.add(fetchOne(
        DevpostScraperService.baseUrl,
        'Home',
        (page) => devpostInfo.value = devpostInfo.value.copyWith(homePage: page),
      ));
    }
    if (!onlyFailed || failedPages.contains('Resources') || devpostInfo.value.resourcesPage.markdownContent.isEmpty) {
      tasks.add(fetchOne(
        '${DevpostScraperService.baseUrl}/resources',
        'Resources',
        (page) => devpostInfo.value = devpostInfo.value.copyWith(resourcesPage: page),
      ));
    }
    if (!onlyFailed || failedPages.contains('Updates') || devpostInfo.value.updatesPage.markdownContent.isEmpty) {
      tasks.add(fetchOne(
        '${DevpostScraperService.baseUrl}/updates',
        'Updates',
        (page) => devpostInfo.value = devpostInfo.value.copyWith(updatesPage: page),
      ));
    }
    if (!onlyFailed || failedPages.contains('Rules') || devpostInfo.value.rulesPage.markdownContent.isEmpty) {
      tasks.add(fetchOne(
        '${DevpostScraperService.baseUrl}/rules',
        'Rules',
        (page) => devpostInfo.value = devpostInfo.value.copyWith(rulesPage: page),
      ));
    }
    if (!onlyFailed || failedPages.contains('Project Gallery') || devpostInfo.value.projectGalleryPage.markdownContent.isEmpty) {
      tasks.add(fetchOne(
        '${DevpostScraperService.baseUrl}/project-gallery',
        'Project Gallery',
        (page) => devpostInfo.value = devpostInfo.value.copyWith(projectGalleryPage: page),
      ));
    }

    if (tasks.isNotEmpty) {
      await Future.wait(tasks);
    }

    statusMessage.value = 'Data fetch completed!';
  }

  Future<void> saveMarkdown() async {
    statusMessage.value = 'Saving Markdown...';
    final result = await _scraperService.saveToMarkdownFile(devpostInfo.value);
    if (result != null) {
      statusMessage.value = 'Saved successfully: $result';
    } else {
      statusMessage.value = 'Failed to save Markdown.';
    }
  }

  /// Retry a single page by its title key.
  Future<void> retryPage(String title) async {
    const Map<String, String> titleToUrl = {
      'Home': DevpostScraperService.baseUrl,
      'Resources': '${DevpostScraperService.baseUrl}/resources',
      'Updates': '${DevpostScraperService.baseUrl}/updates',
      'Rules': '${DevpostScraperService.baseUrl}/rules',
      'Project Gallery': '${DevpostScraperService.baseUrl}/project-gallery',
    };

    final url = titleToUrl[title];
    if (url == null) return;

    pageLoading[title] = true;
    failedPages.remove(title);
    statusMessage.value = 'Đang thử lại: $title...';

    try {
      final page = await _scraperService.fetchPage(url, title);
      if (page != null) {
        switch (title) {
          case 'Home':
            devpostInfo.value = devpostInfo.value.copyWith(homePage: page);
          case 'Resources':
            devpostInfo.value = devpostInfo.value.copyWith(resourcesPage: page);
          case 'Updates':
            devpostInfo.value = devpostInfo.value.copyWith(updatesPage: page);
          case 'Rules':
            devpostInfo.value = devpostInfo.value.copyWith(rulesPage: page);
          case 'Project Gallery':
            devpostInfo.value = devpostInfo.value.copyWith(projectGalleryPage: page);
        }
        statusMessage.value = '$title loaded!';
      } else {
        failedPages.add(title);
        statusMessage.value = 'Thử lại $title thất bại.';
      }
    } catch (e) {
      failedPages.add(title);
      statusMessage.value = 'Lỗi khi tải $title: $e';
    } finally {
      pageLoading[title] = false;
    }
  }
}
