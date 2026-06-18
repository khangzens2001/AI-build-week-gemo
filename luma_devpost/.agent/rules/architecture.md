---
trigger: always_on
---

# Architecture Rules

## 🏗 Modular Widget Strategy
- **Feature-Specific Widgets**: Widgets that are only used within a single feature (e.g., `SocialLoginButton` for Sign In) MUST be placed in `lib/features/<feature_name>/presentation/widgets/`.
- **Global Shared Widgets**: Only truly generic and reusable widgets across the entire app (e.g., `BaseScaffold`, `PrimaryButton`, `CustomTextField`) belong in `lib/core/widgets/`.
- **Barrel Files**: Each `widgets` directory must have a `widgets.dart` or `index.dart` barrel file to export internal widgets, allowing clean imports.

✅ `import 'package:room_scan/features/sign_in/presentation/widgets/widgets.dart';`
❌ `import 'package:room_scan/core/widgets/social_login_button.dart';` (If it's only for Sign In)
