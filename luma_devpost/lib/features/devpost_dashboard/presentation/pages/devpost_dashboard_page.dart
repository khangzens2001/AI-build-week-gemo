import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:luma_devpost/features/devpost_dashboard/data/models/devpost_info_model.dart';
import 'package:luma_devpost/features/devpost_dashboard/presentation/controllers/devpost_dashboard_controller.dart';

class DevpostDashboardPage extends GetView<DevpostDashboardController> {
  const DevpostDashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E1A),
      body: Column(
        children: [
          _AppHeader(controller: controller),
          Expanded(
            child: Obx(() {
              final info = controller.devpostInfo.value;
              return _ContentView(info: info);
            }),
          ),
        ],
      ),
    );
  }
}

// ─── Header ──────────────────────────────────────────────────────────────────

class _AppHeader extends StatelessWidget {
  final DevpostDashboardController controller;
  const _AppHeader({required this.controller});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0A0E1A), Color(0xFF111827)],
        ),
        border: Border(bottom: BorderSide(color: Color(0xFF1E2D40), width: 1)),
      ),
      padding: const EdgeInsets.fromLTRB(24, 48, 24, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF6C63FF), Color(0xFF3B82F6)],
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.hub_outlined, color: Colors.white, size: 22),
              ),
              const SizedBox(width: 12),
              const Text(
                'Devpost Intel',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.5,
                ),
              ),
              const Spacer(),
              _HeaderAction(
                icon: Icons.refresh_rounded,
                label: 'Refresh',
                onTap: controller.refreshData,
              ),
              const SizedBox(width: 8),
              _HeaderAction(
                icon: Icons.file_download_outlined,
                label: 'Export MD',
                onTap: controller.saveMarkdown,
                isPrimary: true,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Obx(() => AnimatedSwitcher(
            duration: const Duration(milliseconds: 300),
            child: controller.statusMessage.value.isEmpty
                ? const SizedBox.shrink()
                : Container(
                    key: ValueKey(controller.statusMessage.value),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF6C63FF).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFF6C63FF).withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.check_circle_outline, color: Color(0xFF6C63FF), size: 14),
                        const SizedBox(width: 6),
                        Text(
                          controller.statusMessage.value,
                          style: const TextStyle(color: Color(0xFFB0BEC5), fontSize: 12),
                        ),
                      ],
                    ),
                  ),
          )),
        ],
      ),
    );
  }
}

class _HeaderAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool isPrimary;

  const _HeaderAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.isPrimary = false,
  });

  @override
  Widget build(BuildContext context) {
    if (isPrimary) {
      return ElevatedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: 16),
        label: Text(label),
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF6C63FF),
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
        ),
      );
    }
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 16),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        foregroundColor: const Color(0xFF90CAF9),
        side: const BorderSide(color: Color(0xFF1E3A5F)),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
      ),
    );
  }
}

// Unused widgets removed.

// ─── Content ──────────────────────────────────────────────────────────────────

class _ContentView extends GetView<DevpostDashboardController> {
  final DevpostInfoModel info;
  const _ContentView({required this.info});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Obx(() => _PageCard(
          page: controller.devpostInfo.value.homePage,
          icon: Icons.home_outlined,
          accentColor: const Color(0xFF6C63FF),
          badge: 'Overview',
          isLoading: controller.pageLoading['Home'] ?? false,
          onRetry: () => controller.retryPage('Home'),
        )),
        const SizedBox(height: 12),
        Obx(() => _PageCard(
          page: controller.devpostInfo.value.resourcesPage,
          icon: Icons.library_books_outlined,
          accentColor: const Color(0xFF10B981),
          badge: 'Resources',
          isLoading: controller.pageLoading['Resources'] ?? false,
          onRetry: () => controller.retryPage('Resources'),
        )),
        const SizedBox(height: 12),
        Obx(() => _PageCard(
          page: controller.devpostInfo.value.rulesPage,
          icon: Icons.gavel_outlined,
          accentColor: const Color(0xFFEF4444),
          badge: 'Rules',
          isLoading: controller.pageLoading['Rules'] ?? false,
          onRetry: () => controller.retryPage('Rules'),
        )),
        const SizedBox(height: 12),
        Obx(() => _PageCard(
          page: controller.devpostInfo.value.projectGalleryPage,
          icon: Icons.grid_view_rounded,
          accentColor: const Color(0xFF3B82F6),
          badge: 'Gallery',
          isLoading: controller.pageLoading['Project Gallery'] ?? false,
          onRetry: () => controller.retryPage('Project Gallery'),
        )),
        const SizedBox(height: 12),
        Obx(() => _PageCard(
          page: controller.devpostInfo.value.updatesPage,
          icon: Icons.campaign_outlined,
          accentColor: const Color(0xFFF59E0B),
          badge: 'Updates',
          isLoading: controller.pageLoading['Updates'] ?? false,
          onRetry: () => controller.retryPage('Updates'),
        )),
        const SizedBox(height: 24),
      ],
    );
  }
}

class _PageCard extends StatefulWidget {
  final DevpostPageContent page;
  final IconData icon;
  final Color accentColor;
  final String badge;
  final bool isLoading;
  final VoidCallback onRetry;

  const _PageCard({
    required this.page,
    required this.icon,
    required this.accentColor,
    required this.badge,
    required this.isLoading,
    required this.onRetry,
  });

  @override
  State<_PageCard> createState() => _PageCardState();
}

class _PageCardState extends State<_PageCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final content = widget.page.markdownContent.trim();
    // Show preview: first 400 chars
    final preview = content.length > 400 ? content.substring(0, 400) : content;

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF111827),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: widget.accentColor.withValues(alpha: 0.25),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: widget.accentColor.withValues(alpha: 0.06),
            blurRadius: 20,
            spreadRadius: 0,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: widget.accentColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(widget.icon, color: widget.accentColor, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            widget.page.title,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: widget.accentColor.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              widget.badge,
                              style: TextStyle(
                                color: widget.accentColor,
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        widget.page.url,
                        style: TextStyle(
                          color: widget.accentColor.withValues(alpha: 0.7),
                          fontSize: 11,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                if (widget.isLoading)
                  const Padding(
                    padding: EdgeInsets.all(12),
                    child: SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF6C63FF)),
                      ),
                    ),
                  )
                else ...[   
                  if (!widget.isLoading && widget.page.markdownContent.trim().isEmpty)
                    IconButton(
                      onPressed: widget.onRetry,
                      tooltip: 'Thử lại',
                      icon: const Icon(Icons.replay_rounded, color: Color(0xFFEF4444), size: 20),
                    ),
                  IconButton(
                    onPressed: () => setState(() => _expanded = !_expanded),
                    icon: AnimatedRotation(
                      turns: _expanded ? 0.5 : 0,
                      duration: const Duration(milliseconds: 250),
                      child: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF546E7A)),
                    ),
                  ),
                ],
              ],
            ),
          ),

          // Divider
          Divider(color: widget.accentColor.withValues(alpha: 0.1), height: 1),

          // Content
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (content.isEmpty)
                  widget.isLoading
                      ? Row(
                          children: [
                            const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF6C63FF)),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Đang tải dữ liệu...',
                              style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 13),
                            ),
                          ],
                        )
                      : Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Tải thất bại hoặc chưa có dữ liệu.',
                                style: TextStyle(color: Colors.white.withValues(alpha: 0.3), fontSize: 13),
                              ),
                            ),
                            const SizedBox(width: 8),
                            TextButton.icon(
                              onPressed: widget.onRetry,
                              icon: const Icon(Icons.replay_rounded, size: 15),
                              label: const Text('Thử lại', style: TextStyle(fontSize: 12)),
                              style: TextButton.styleFrom(
                                foregroundColor: const Color(0xFF6C63FF),
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              ),
                            ),
                          ],
                        )
                else ...[
                  _MarkdownText(text: _expanded ? content : '$preview${content.length > 400 ? '...' : ''}'),
                  if (content.length > 400) ...[
                    const SizedBox(height: 12),
                    GestureDetector(
                      onTap: () => setState(() => _expanded = !_expanded),
                      child: Text(
                        _expanded ? '▲ Thu gọn' : '▼ Xem đầy đủ (${content.length} ký tự)',
                        style: TextStyle(
                          color: widget.accentColor,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// Simple markdown-like text renderer
class _MarkdownText extends StatelessWidget {
  final String text;
  const _MarkdownText({required this.text});

  @override
  Widget build(BuildContext context) {
    final lines = text.split('\n');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: lines.map((line) {
        if (line.startsWith('#### ')) {
          return _styledText(line.substring(5), 13, FontWeight.w700, Colors.white);
        } else if (line.startsWith('### ')) {
          return _styledText(line.substring(4), 14, FontWeight.w700, const Color(0xFFE2E8F0));
        } else if (line.startsWith('## ')) {
          return _styledText(line.substring(3), 15, FontWeight.w800, Colors.white);
        } else if (line.startsWith('# ')) {
          return _styledText(line.substring(2), 17, FontWeight.w900, Colors.white);
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.only(top: 5, right: 6),
                  child: CircleAvatar(backgroundColor: Color(0xFF6C63FF), radius: 2.5),
                ),
                Expanded(child: Text(line.substring(2), style: _bodyStyle)),
              ],
            ),
          );
        } else if (line.trim().isEmpty) {
          return const SizedBox(height: 6);
        } else {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Text(line, style: _bodyStyle),
          );
        }
      }).toList(),
    );
  }

  static const TextStyle _bodyStyle = TextStyle(
    color: Color(0xFF94A3B8),
    fontSize: 12.5,
    height: 1.6,
  );

  Widget _styledText(String text, double size, FontWeight weight, Color color) {
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 2),
      child: Text(text, style: TextStyle(color: color, fontSize: size, fontWeight: weight, height: 1.4)),
    );
  }
}
