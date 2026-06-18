// ignore_for_file: depend_on_referenced_packages
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';

class StorageService extends GetxService {
  static StorageService get to => Get.find<StorageService>();
  late SharedPreferences _prefs;

  Future<StorageService> init() async {
    _prefs = await SharedPreferences.getInstance();
    return this;
  }

  Future<bool> write(String key, dynamic value) async {
    if (value is String) return await _prefs.setString(key, value);
    if (value is int) return await _prefs.setInt(key, value);
    if (value is double) return await _prefs.setDouble(key, value);
    if (value is bool) return await _prefs.setBool(key, value);
    if (value is List<String>) return await _prefs.setStringList(key, value);
    return false;
  }

  T? read<T>(String key) {
    if (T == String) return _prefs.getString(key) as T?;
    if (T == int) return _prefs.getInt(key) as T?;
    if (T == double) return _prefs.getDouble(key) as T?;
    if (T == bool) return _prefs.getBool(key) as T?;
    if (T == List<String>) return _prefs.getStringList(key) as T?;
    return _prefs.get(key) as T?;
  }

  Future<bool> remove(String key) async => await _prefs.remove(key);
  Future<bool> clear() async => await _prefs.clear();
}
