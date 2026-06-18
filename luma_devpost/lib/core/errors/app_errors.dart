/// Base class for all app errors
abstract class AppError implements Exception {
  final String message;
  final String? code;
  final dynamic originalError;

  AppError(this.message, {this.code, this.originalError});

  @override
  String toString() => message;
}

/// Storage-related errors
class StorageError extends AppError {
  StorageError(super.message, {super.code, super.originalError});
}

/// Data validation errors
class ValidationError extends AppError {
  final String field;

  ValidationError(
    super.message, {
    required this.field,
    super.code,
    super.originalError,
  });
}

/// Data not found errors
class NotFoundError extends AppError {
  NotFoundError(super.message, {super.code, super.originalError});
}

/// Network-related errors (for future use)
class NetworkError extends AppError {
  NetworkError(super.message, {super.code, super.originalError});
}

/// Permission-related errors
class PermissionError extends AppError {
  PermissionError(super.message, {super.code, super.originalError});
}

/// General application errors
class AppException extends AppError {
  AppException(super.message, {super.code, super.originalError});
}
