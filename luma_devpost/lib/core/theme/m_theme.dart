import 'package:flutter/material.dart';
import 'package:luma_devpost/core/theme/m_color.dart';
import 'package:luma_devpost/core/theme/m_text_theme.dart';

/// Application theme configuration.
/// Use `MTheme.light` and `MTheme.dark` for theme data.
class MTheme {
  MTheme._();

  // Light Theme
  static ThemeData get light => ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    primaryColor: MColors.primary,
    scaffoldBackgroundColor: MColors.backgroundLight,
    cardColor: Colors.white,
    canvasColor: MColors.surfaceLight,
    colorScheme: const ColorScheme(
      brightness: Brightness.light,
      primary: MColors.primary,
      onPrimary: Colors.white,
      secondary: MColors.secondary,
      onSecondary: Colors.white,
      surface: Colors.white,
      onSurface: MColors.textLight,
      error: MColors.error,
      onError: Colors.white,
    ),
    fontFamily: MTextTheme.fontFamily,
    textTheme: MTextTheme.lightTextTheme,
    appBarTheme: const AppBarTheme(
      backgroundColor: MColors.backgroundLight,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      iconTheme: IconThemeData(color: MColors.textLight),
      titleTextStyle: TextStyle(
        color: MColors.textLight,
        fontSize: 20,
        fontWeight: FontWeight.w600,
      ),
    ),
  );

  // Dark Theme
  static ThemeData get dark => ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    primaryColor: MColors.primaryForDark,
    scaffoldBackgroundColor: MColors.backgroundDark,
    cardColor: MColors.surfaceDark,
    canvasColor: MColors.surfaceDark,
    colorScheme: const ColorScheme(
      brightness: Brightness.dark,
      primary: MColors.primaryForDark,
      onPrimary: Colors.black,
      secondary: MColors.secondaryLight,
      onSecondary: Colors.black,
      surface: MColors.surfaceDark,
      onSurface: MColors.textDark,
      error: MColors.error,
      onError: Colors.white,
    ),
    fontFamily: MTextTheme.fontFamily,
    textTheme: MTextTheme.darkTextTheme,
    appBarTheme: const AppBarTheme(
      backgroundColor: MColors.backgroundDark,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      iconTheme: IconThemeData(color: MColors.textDark),
      titleTextStyle: TextStyle(
        color: MColors.textDark,
        fontSize: 20,
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}
