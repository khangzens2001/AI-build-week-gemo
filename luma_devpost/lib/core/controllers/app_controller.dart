import 'dart:async';
import 'package:get/get.dart';

/// AppController manages app-wide features and state.
class AppController extends SuperController {
  bool _isPaused = false;
  StreamSubscription? _streamSubscription;

  @override
  Future<void> initData() async {
    // Initialize app-wide data here
  }

  @override
  void onClose() {
    _streamSubscription?.cancel();
    super.onClose();
  }

  @override
  void onReady() {
    super.onReady();
  }

  @override
  void onResumed() {
    if (!_isPaused) return;
    _isPaused = false;
  }

  @override
  void onPaused() {
    _isPaused = true;
  }

  @override
  void onDetached() {}

  @override
  void onHidden() {}

  @override
  void onInactive() {}
}
