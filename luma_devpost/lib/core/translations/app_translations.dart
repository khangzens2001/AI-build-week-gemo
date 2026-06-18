import 'package:get/get.dart';
import 'package:luma_devpost/core/constants/app_constants.dart';
import 'package:luma_devpost/core/translations/en.dart' as en_translations;
import 'package:luma_devpost/core/translations/vi.dart' as vi_translations;

class AppTranslations extends Translations {
  @override
  Map<String, Map<String, String>> get keys => {
        AppConstants.langEnglish: en_translations.en,
        AppConstants.langVietnamese: vi_translations.vi,
      };
}
