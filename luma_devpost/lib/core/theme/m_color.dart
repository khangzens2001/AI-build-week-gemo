import 'package:flutter/material.dart';

/// Color palette for the application.
/// Access colors via `MColors.primary`, `MColors.secondary`, etc.
class MColors {
  MColors._();

  // Primary Palette
  static const Color primary = Color(0xFF4CAF50);
  static const Color primaryDark = Color(0xFF388E3C);
  static const Color primaryLight = Color(0xFFC8E6C9);
  static const Color primaryForDark = Color(0xFF81C784);

  // Secondary Palette
  static const Color secondary = Color(0xFF03A9F4);
  static const Color secondaryDark = Color(0xFF0288D1);
  static const Color secondaryLight = Color(0xFFB3E5FC);

  // Neutral Colors
  static const Color backgroundLight = Color(0xFFF5F5F5);
  static const Color backgroundDark = Color(0xFF121212);
  static const Color surfaceLight = Color(0xFFFFFFFF);
  static const Color surfaceDark = Color(0xFF1E1E1E);

  // Text Colors
  static const Color textLight = Color(0xFF212121);
  static const Color textDark = Color(0xFFE0E0E0);
  static const Color textSecondaryLight = Color(0xFF757575);
  static const Color textSecondaryDark = Color(0xFFBDBDBD);

  // Status Colors
  static const Color error = Color(0xFFD32F2F);
  static const Color success = Color(0xFF388E3C);
  static const Color warning = Color(0xFFFFA000);
  static const Color info = Color(0xFF1976D2);
}
