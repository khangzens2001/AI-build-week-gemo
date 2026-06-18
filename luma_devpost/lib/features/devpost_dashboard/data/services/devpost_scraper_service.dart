import 'dart:convert';
import 'dart:math'; // 1. Thêm import này để dùng hàm chọn ngẫu nhiên

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:get/get.dart';
import 'package:html/parser.dart' as html_parser;
import 'package:luma_devpost/core/utils/html_to_markdown_utils.dart';
import 'package:luma_devpost/features/devpost_dashboard/data/models/devpost_info_model.dart';
import 'package:path_provider/path_provider.dart';
import 'package:universal_html/html.dart' as universal_html;
import 'package:universal_io/io.dart'; // Cross-platform File

class DevpostScraperService extends GetxService {
  final Dio _dio = Dio();
  final Random _random = Random(); // Khởi tạo bộ sinh số ngẫu nhiên

  static const String baseUrl =
      'https://agentic-ai-build-week-2026.devpost.com';

  // 2. Gom 2 proxy Worker của bạn vào một danh sách đồng nhất cấu trúc (?url=)
  static const List<String> _proxyList = [
    // 'https://small-lake-9a5e.rithamto.workers.dev/?url=',
    // 'https://lively-sun-f664.khangdh.workers.dev/?url=',
    'https://muddy-bush-e034.rithamto.workers.dev/?url=',
  ];

  /// Các chuỗi lỗi đặc trưng từ proxy / Cloudflare / bot-block
  static const List<String> _proxyErrorSignals = [
    'Request failed. You will not be charged',
    'Protected domains may require adding premium',
    'premium=true OR ultra_premium=true',
    'Access denied',
    'Error 1015', // Cloudflare rate-limit
    'Error 1020', // Cloudflare access denied
    'Checking your browser',
    'Please enable JavaScript',
    'cf-browser-verification',
  ];

  Future<DevpostPageContent?> fetchPage(String url, String title) async {
    // 3. Chọn ngẫu nhiên 1 trong các proxy từ danh sách trên
    final String chosenProxy = _proxyList[_random.nextInt(_proxyList.length)];

    // Web thì đi qua proxy ngẫu nhiên vừa chọn, Mobile/Desktop chạy thẳng
    final String fetchUrl = kIsWeb
        ? '$chosenProxy${Uri.encodeComponent(url)}'
        : url;

    // Log ra để bạn dễ theo dõi xem request này đang đi qua đầu worker nào
    debugPrint('[$title] Fetching via: $fetchUrl');

    try {
      final response = await _dio.get<String>(
        fetchUrl,
        options: Options(responseType: ResponseType.plain),
      );

      if (response.statusCode == 200 && response.data != null) {
        String html = response.data!;
        if (html.trim().isEmpty) return null;

        // Kiểm tra xem response có chứa thông báo lỗi từ proxy / bot-block không
        final lowerHtml = html.toLowerCase();
        for (final signal in _proxyErrorSignals) {
          if (lowerHtml.contains(signal.toLowerCase())) {
            debugPrint('[$title] Proxy/bot-block error detected: "$signal"');
            return null; // coi là fail để hiện nút Thử lại
          }
        }

        // Vì proxy này trả trực tiếp HTML chuẩn (raw), bạn không cần parse JSON gì cả!
        final document = html_parser.parse(html);

        final mainSection =
            document.getElementById('main') ??
            document.querySelector('section[role="main"]') ??
            document.body;

        if (mainSection == null) return null;
        final markdown = HtmlToMarkdownUtils.convert(mainSection);

        // Nếu markdown trống hoặc chỉ chứa whitespace cũng coi là fail
        if (markdown.trim().isEmpty) return null;

        return DevpostPageContent(
          title: title,
          url: url,
          markdownContent: markdown,
        );
      }
    } catch (e) {
      debugPrint('Lỗi cào dữ liệu trang $title: $e');
    }
    return null;
  }

  Future<DevpostScraperService> init() async {
    return this;
  }

  Future<DevpostInfoModel?> fetchAndParseAll() async {
    try {
      final results = await Future.wait([
        fetchPage(
          '$baseUrl/?_gl=1*1rtrx2i*_gcl_au*MTY0NzUxODM1MC4xNzgxNjc4NTk3*_ga*NzM0NzQ5MjExLjE3ODE2Nzg1OTc.*_ga_0YHJK3Y10M*czE3ODE3MTM3MjQkbzUkZzAkdDE3ODE3MTM3MjQkajYwJGwwJGgw',
          'Home',
        ),
        fetchPage('$baseUrl/resources', 'Resources'),
        fetchPage('$baseUrl/updates', 'Updates'),
        fetchPage('$baseUrl/rules', 'Rules'),
        fetchPage('$baseUrl/project-gallery', 'Project Gallery'),
      ]);

      if (results.every((p) => p != null)) {
        return DevpostInfoModel(
          homePage: results[0]!,
          resourcesPage: results[1]!,
          updatesPage: results[2]!,
          rulesPage: results[3]!,
          projectGalleryPage: results[4]!,
        );
      }

      return DevpostInfoModel(
        homePage:
            results[0] ??
            DevpostPageContent(
              title: 'Home',
              url: baseUrl,
              markdownContent: '',
            ),
        resourcesPage:
            results[1] ??
            DevpostPageContent(
              title: 'Resources',
              url: '$baseUrl/resources',
              markdownContent: '',
            ),
        updatesPage:
            results[2] ??
            DevpostPageContent(
              title: 'Updates',
              url: '$baseUrl/updates',
              markdownContent: '',
            ),
        rulesPage:
            results[3] ??
            DevpostPageContent(
              title: 'Rules',
              url: '$baseUrl/rules',
              markdownContent: '',
            ),
        projectGalleryPage:
            results[4] ??
            DevpostPageContent(
              title: 'Project Gallery',
              url: '$baseUrl/project-gallery',
              markdownContent: '',
            ),
      );
    } catch (e) {
      debugPrint('Error fetching Devpost data: $e');
      return null;
    }
  }

  Future<String?> saveToMarkdownFile(DevpostInfoModel data) async {
    try {
      final markdownString = data.toFullMarkdown();
      final fileName =
          'devpost_context_${DateTime.now().millisecondsSinceEpoch}.md';

      if (kIsWeb) {
        final bytes = utf8.encode(markdownString);
        final blob = universal_html.Blob([bytes]);
        final url = universal_html.Url.createObjectUrlFromBlob(blob);
        final anchor =
            universal_html.document.createElement('a')
                  as universal_html.AnchorElement
              ..href = url
              ..style.display = 'none'
              ..download = fileName;
        universal_html.document.body?.children.add(anchor);
        anchor.click();
        anchor.remove();
        universal_html.Url.revokeObjectUrl(url);
        return 'Downloaded $fileName';
      } else {
        final directory = await getApplicationDocumentsDirectory();
        final file = File('${directory.path}/$fileName');
        await file.writeAsString(markdownString);
        return file.path;
      }
    } catch (e) {
      debugPrint('Error saving markdown file: $e');
      return null;
    }
  }
}
