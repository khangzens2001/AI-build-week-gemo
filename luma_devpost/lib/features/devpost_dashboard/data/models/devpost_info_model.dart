class DevpostPageContent {
  final String title;
  final String url;
  final String markdownContent;

  DevpostPageContent({
    required this.title,
    required this.url,
    required this.markdownContent,
  });

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'url': url,
      'markdownContent': markdownContent,
    };
  }

  factory DevpostPageContent.fromJson(Map<String, dynamic> json) {
    return DevpostPageContent(
      title: json['title'] as String,
      url: json['url'] as String,
      markdownContent: json['markdownContent'] as String,
    );
  }
}

class DevpostInfoModel {
  final DevpostPageContent homePage;
  final DevpostPageContent resourcesPage;
  final DevpostPageContent updatesPage;
  final DevpostPageContent rulesPage;
  final DevpostPageContent projectGalleryPage;

  DevpostInfoModel({
    required this.homePage,
    required this.resourcesPage,
    required this.updatesPage,
    required this.rulesPage,
    required this.projectGalleryPage,
  });

  DevpostInfoModel copyWith({
    DevpostPageContent? homePage,
    DevpostPageContent? resourcesPage,
    DevpostPageContent? updatesPage,
    DevpostPageContent? rulesPage,
    DevpostPageContent? projectGalleryPage,
  }) {
    return DevpostInfoModel(
      homePage: homePage ?? this.homePage,
      resourcesPage: resourcesPage ?? this.resourcesPage,
      updatesPage: updatesPage ?? this.updatesPage,
      rulesPage: rulesPage ?? this.rulesPage,
      projectGalleryPage: projectGalleryPage ?? this.projectGalleryPage,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'homePage': homePage.toJson(),
      'resourcesPage': resourcesPage.toJson(),
      'updatesPage': updatesPage.toJson(),
      'rulesPage': rulesPage.toJson(),
      'projectGalleryPage': projectGalleryPage.toJson(),
    };
  }

  factory DevpostInfoModel.fromJson(Map<String, dynamic> json) {
    return DevpostInfoModel(
      homePage: DevpostPageContent.fromJson(json['homePage'] as Map<String, dynamic>),
      resourcesPage: DevpostPageContent.fromJson(json['resourcesPage'] as Map<String, dynamic>),
      updatesPage: DevpostPageContent.fromJson(json['updatesPage'] as Map<String, dynamic>),
      rulesPage: DevpostPageContent.fromJson(json['rulesPage'] as Map<String, dynamic>),
      projectGalleryPage: DevpostPageContent.fromJson(json['projectGalleryPage'] as Map<String, dynamic>),
    );
  }

  String toFullMarkdown() {
    final buffer = StringBuffer();
    buffer.writeln('# Devpost Aggregate Information');
    buffer.writeln('Extracted on: ${DateTime.now().toIso8601String()}\n');

    for (final page in [
      homePage,
      resourcesPage,
      updatesPage,
      rulesPage,
      projectGalleryPage,
    ]) {
      buffer.writeln('## ${page.title}');
      buffer.writeln('URL: ${page.url}\n');
      buffer.writeln(page.markdownContent);
      buffer.writeln('\n---\n');
    }

    return buffer.toString();
  }
}
