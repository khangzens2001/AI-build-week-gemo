import 'package:html/dom.dart' as dom;

class HtmlToMarkdownUtils {
  HtmlToMarkdownUtils._();

  static String convert(dom.Element? element) {
    if (element == null) return '';
    return _processNode(element).trim();
  }

  static String _processNode(dom.Node node) {
    if (node is dom.Text) {
      // Clean up whitespace but preserve newlines
      final text = node.text.replaceAll(RegExp(r'[ \t]+'), ' ');
      return text;
    }

    if (node is dom.Element) {
      final tagName = node.localName?.toLowerCase();
      String content = node.nodes.map(_processNode).join('');

      switch (tagName) {
        case 'h1':
          return '\n# ${content.trim()}\n\n';
        case 'h2':
          return '\n## ${content.trim()}\n\n';
        case 'h3':
          return '\n### ${content.trim()}\n\n';
        case 'h4':
          return '\n#### ${content.trim()}\n\n';
        case 'h5':
          return '\n##### ${content.trim()}\n\n';
        case 'h6':
          return '\n###### ${content.trim()}\n\n';
        case 'p':
        case 'div':
        case 'section':
          return '\n${content.trim()}\n';
        case 'br':
          return '  \n';
        case 'strong':
        case 'b':
          return '**${content.trim()}**';
        case 'em':
        case 'i':
          return '*${content.trim()}*';
        case 'a':
          final href = node.attributes['href'] ?? '';
          if (href.isEmpty) return content;
          return '[$content]($href)';
        case 'img':
          final src = node.attributes['src'] ?? '';
          final alt = node.attributes['alt'] ?? '';
          return '![$alt]($src)';
        case 'ul':
          return '\n$content\n';
        case 'ol':
          // A bit simplified, ol doesn't track index here perfectly
          return '\n$content\n';
        case 'li':
          // Check parent to see if ul or ol
          final parentName = node.parent?.localName?.toLowerCase();
          if (parentName == 'ol') {
            return '1. ${content.trim()}\n';
          }
          return '- ${content.trim()}\n';
        case 'table':
          return '\n$content\n';
        case 'tr':
          return '|$content\n';
        case 'th':
        case 'td':
          return ' ${content.trim()} |';
        case 'thead':
          // Add a separator line after thead
          final headersCount = node.querySelectorAll('th').length;
          final separator = List.filled(headersCount, '---').join(' | ');
          return '$content| $separator |\n';
        default:
          return content;
      }
    }
    return '';
  }
}
