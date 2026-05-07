---
name: rich-text
description: "Software Mansion's best practices for rich text in React Native using react-native-enriched and react-native-enriched-markdown. Use when building rich text editors, formatted text inputs, Markdown renderers, or any feature requiring inline styling, mentions, links, structured text editing, or Markdown display. Trigger on: 'rich text editor', 'rich text input', 'text editor', 'react-native-enriched', 'react-native-enriched-markdown', 'EnrichedTextInput', 'EnrichedMarkdownText', 'formatted text input', 'WYSIWYG', 'mentions input', 'text formatting toolbar', 'markdown renderer', 'markdown display', 'render markdown', 'display markdown natively', 'LaTeX math', 'GFM tables', or any request to build rich text editing or Markdown rendering in React Native."
---

# Rich Text in React Native

Software Mansion's production patterns for rich text editing and Markdown rendering in React Native.

There are two libraries that cover rich text use cases:

| Library | Component | Purpose |
|---------|-----------|---------|
| `react-native-enriched` | `EnrichedTextInput` | Rich text **editing** (input) |
| `react-native-enriched-markdown` | `EnrichedMarkdownText` | Markdown **rendering** (display) |

Both libraries require the React Native New Architecture (Fabric) and support iOS and Android.

## Choosing the right library

- **User needs to type/edit rich text** (bold, italic, mentions, links, inline images): use `react-native-enriched`
- **App needs to display Markdown content** (chat messages, documentation, AI responses): use `react-native-enriched-markdown`
- **Both editing and display**: use both libraries together

## react-native-enriched (Editor)

`EnrichedTextInput` is a native, uncontrolled rich text input. It directly interacts with platform-specific components for performance, meaning it does not use React state for its value.

```bash
npm install react-native-enriched
```

### Basic usage

```tsx
import { EnrichedTextInput } from 'react-native-enriched';
import type {
  EnrichedTextInputInstance,
  OnChangeStateEvent,
} from 'react-native-enriched';
import { useState, useRef } from 'react';
import { View, Button, StyleSheet } from 'react-native';

export default function RichEditor() {
  const ref = useRef<EnrichedTextInputInstance>(null);
  const [stylesState, setStylesState] = useState<OnChangeStateEvent | null>();

  return (
    <View style={styles.container}>
      <EnrichedTextInput
        ref={ref}
        onChangeState={(e) => setStylesState(e.nativeEvent)}
        style={styles.input}
      />
      <Button
        title={stylesState?.bold.isActive ? 'Unbold' : 'Bold'}
        color={stylesState?.bold.isActive ? 'green' : 'gray'}
        onPress={() => ref.current?.toggleBold()}
      />
    </View>
  );
}
```

### Key concepts

**Toggling styles via ref**: All formatting is applied imperatively through the ref. Call `ref.current?.toggleBold()`, `ref.current?.toggleItalic()`, etc.

**Style detection via onChangeState**: The `onChangeState` callback fires whenever the style state changes (e.g., cursor moves into bold text). Each style reports three properties:
- `isActive`: The style is applied at the current selection (highlight the toolbar button)
- `isBlocking`: The style is blocked by another active style (disable the toolbar button)
- `isConflicting`: The style conflicts with another active style (toggling it removes the conflicting style)

**Inline vs paragraph styles**:
- Inline styles (bold, italic, underline, strikethrough, inline code) apply to the exact character range selected. With no selection, they apply to the next characters typed.
- Paragraph styles (headings, codeblock, blockquote, lists) apply to entire paragraphs (text between newlines). If the selection spans multiple paragraphs, all are affected.

**HTML output**: Get HTML via `ref.current?.getHTML()` (on-demand, returns a Promise) or the `onChangeHtml` callback (continuous, has performance cost for large documents). Prefer `getHTML()` when you only need HTML at save time.

**Setting content**: Use `defaultValue` prop for initial HTML content, or `ref.current?.setValue(html)` to update imperatively.

### Supported styles

The `OnChangeStateEvent` key column shows the exact property name on the event object returned by `onChangeState`. Use these keys when reading style state (e.g. `stylesState.strikeThrough.isActive`). Note that casing varies (e.g. `strikeThrough` with capital T, `inlineCode` with capital C).

| Style | Toggle method | `OnChangeStateEvent` key | Type |
|-------|--------------|--------------------------|------|
| Bold | `toggleBold()` | `bold` | Inline |
| Italic | `toggleItalic()` | `italic` | Inline |
| Underline | `toggleUnderline()` | `underline` | Inline |
| Strikethrough | `toggleStrikeThrough()` | `strikeThrough` | Inline |
| Inline code | `toggleInlineCode()` | `inlineCode` | Inline |
| H1 | `toggleH1()` | `h1` | Paragraph |
| H2 | `toggleH2()` | `h2` | Paragraph |
| H3 | `toggleH3()` | `h3` | Paragraph |
| H4 | `toggleH4()` | `h4` | Paragraph |
| H5 | `toggleH5()` | `h5` | Paragraph |
| H6 | `toggleH6()` | `h6` | Paragraph |
| Code block | `toggleCodeBlock()` | `codeBlock` | Paragraph |
| Block quote | `toggleBlockQuote()` | `blockQuote` | Paragraph |
| Ordered list | `toggleOrderedList()` | `orderedList` | Paragraph |
| Unordered list | `toggleUnorderedList()` | `unorderedList` | Paragraph |
| Checkbox list | `toggleCheckboxList(checked)` | `checkboxList` | Paragraph |

### Links

Links are detected automatically (customizable via `linkRegex` prop) or applied manually:

```tsx
// Set link on selected text
ref.current?.setLink(selection.start, selection.end, selectedText, url);

// Remove link
ref.current?.removeLink(start, end);
```

Use `onChangeSelection` to get selection position and `onLinkDetected` to detect when the cursor is near a link.

### Mentions

Mentions support custom indicators (default: `@`). Set custom indicators via the `mentionIndicators` prop.

```tsx
<EnrichedTextInput
  ref={ref}
  mentionIndicators={['@', '#']}
  onStartMention={(indicator) => { /* show picker */ }}
  onChangeMention={({ indicator, text }) => { /* filter list */ }}
  onEndMention={(indicator) => { /* hide picker */ }}
/>

// Complete the mention when user selects from picker
ref.current?.setMention('@', 'John Doe', { userId: '123' });
```

### Inline images

```tsx
ref.current?.setImage(imageUri, width, height);
```

Images are inserted at the cursor position (or replace selected text) and affect line height. You are responsible for providing correct dimensions.

For the full API (all props, ref methods, events, HtmlStyle customization, context menu items), webfetch the [react-native-enriched README](https://github.com/software-mansion/react-native-enriched/blob/main/README.md).

---

## react-native-enriched-markdown (Renderer)

`EnrichedMarkdownText` renders Markdown as fully native text (no WebView). It uses [md4c](https://github.com/mity/md4c) for high-performance CommonMark-compliant parsing.

```bash
npm install react-native-enriched-markdown
```

### Basic usage

```tsx
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { Linking } from 'react-native';

const markdown = `
# Welcome

This is **bold**, *italic*, and [a link](https://reactnative.dev).

- List item one
- List item two
`;

export default function MarkdownDisplay() {
  return (
    <EnrichedMarkdownText
      markdown={markdown}
      onLinkPress={({ url }) => Linking.openURL(url)}
    />
  );
}
```

### Flavors

| Flavor | Features | Layout |
|--------|----------|--------|
| `commonmark` (default) | All CommonMark elements, inline math (`$...$`) | Single TextView |
| `github` | CommonMark + GFM tables, task lists, block math (`$$...$$`) | Segmented layout (separate TextViews + table views) |

```tsx
<EnrichedMarkdownText
  flavor="github"
  markdown={markdown}
  onLinkPress={({ url }) => Linking.openURL(url)}
/>
```

### Tables (GFM)

Tables require `flavor="github"` and support column alignment, rich text in cells, horizontal scrolling, header styling, alternating row colors, and a long-press context menu.

```tsx
<EnrichedMarkdownText
  flavor="github"
  markdown={tableMarkdown}
  markdownStyle={{
    table: {
      fontSize: 14,
      borderColor: '#E5E7EB',
      borderRadius: 8,
      headerBackgroundColor: '#F3F4F6',
      cellPaddingHorizontal: 12,
      cellPaddingVertical: 8,
    },
  }}
/>
```

### Task lists (GFM)

Task lists require `flavor="github"`. Handle checkbox taps with `onTaskListItemPress`:

```tsx
<EnrichedMarkdownText
  flavor="github"
  markdown={`- [x] Done\n- [ ] Todo`}
  onTaskListItemPress={({ index, checked, text }) => {
    console.log(`Task ${index}: ${checked ? 'checked' : 'unchecked'}`);
  }}
/>
```

### LaTeX math

- **Inline math** (`$...$`): works in both flavors
- **Block math** (`$$...$$`): requires `flavor="github"`, must be on its own line

Use `String.raw` or double backslashes for LaTeX commands in JS strings.

Disable math to reduce bundle size (iosMath ~2.5 MB on iOS):
```tsx
<EnrichedMarkdownText md4cFlags={{ latexMath: false }} markdown="..." />
```

### Customizing styles

Use the `markdownStyle` prop. Memoize it with `useMemo` to avoid re-renders:

```tsx
import type { MarkdownStyle } from 'react-native-enriched-markdown';

const markdownStyle: MarkdownStyle = useMemo(() => ({
  paragraph: { fontSize: 16, color: '#333', lineHeight: 24 },
  h1: { fontSize: 32, fontWeight: 'bold', marginBottom: 16 },
  code: { color: '#E91E63', backgroundColor: '#F5F5F5' },
  codeBlock: { backgroundColor: '#1E1E1E', color: '#D4D4D4', padding: 16, borderRadius: 8 },
  link: { color: '#007AFF', underline: true },
  blockquote: { borderColor: '#007AFF', backgroundColor: '#F0F8FF' },
}), []);
```

Inline elements inherit typography from their parent block (fontSize, fontFamily, color), then add their own styling on top.

### Link handling

```tsx
<EnrichedMarkdownText
  markdown={content}
  onLinkPress={({ url }) => Linking.openURL(url)}
  onLinkLongPress={({ url }) => showShareSheet(url)}
  // On iOS, providing onLinkLongPress disables the system link preview
/>
```

### Additional features

- **Text selection and copy**: Enabled by default (`selectable` prop). Smart Copy provides plain text, Markdown, HTML, RTF, and RTFD on iOS.
- **Accessibility**: VoiceOver and TalkBack support with custom rotors (iOS), semantic heading/link/image navigation, and proper list announcements.
- **RTL**: Automatic on Android. On iOS, call `I18nManager.forceRTL(true)` before rendering.
- **Image caching**: Three-tier caching (memory originals, memory processed variants, disk) with request deduplication.
- **Underline mode**: `md4cFlags={{ underline: true }}` makes `_text_` render as underline instead of italic.

For detailed API documentation, webfetch the relevant page from the upstream docs:

- [API Reference (props, events)](https://github.com/software-mansion-labs/react-native-enriched-markdown/blob/main/docs/API_REFERENCE.md)
- [Styles (MarkdownStyle properties)](https://github.com/software-mansion-labs/react-native-enriched-markdown/blob/main/docs/STYLES.md)
- [Elements Structure (Markdown-to-native mapping)](https://github.com/software-mansion-labs/react-native-enriched-markdown/blob/main/docs/ELEMENTS_STRUCTURE.md)
- [Accessibility (VoiceOver, TalkBack)](https://github.com/software-mansion-labs/react-native-enriched-markdown/blob/main/docs/ACCESSIBILITY.md)
- [RTL Support](https://github.com/software-mansion-labs/react-native-enriched-markdown/blob/main/docs/RTL.md)
- [Image Caching](https://github.com/software-mansion-labs/react-native-enriched-markdown/blob/main/docs/IMAGE_CACHING.md)
- [Copy Options (Smart Copy, copy-as-Markdown)](https://github.com/software-mansion-labs/react-native-enriched-markdown/blob/main/docs/COPY_OPTIONS.md)
- [LaTeX Math](https://github.com/software-mansion-labs/react-native-enriched-markdown/blob/main/docs/LATEX_MATH.md)
- [macOS Support](https://github.com/software-mansion-labs/react-native-enriched-markdown/blob/main/docs/MACOS.md)

---

## Known limitations

### react-native-enriched
- Only one level of lists (no nested lists)
- iOS headings cannot have the same `fontSize` as the input's `fontSize`

### react-native-enriched-markdown
- `flavor="github"` segments text into separate TextViews, so text selection cannot span across segments
