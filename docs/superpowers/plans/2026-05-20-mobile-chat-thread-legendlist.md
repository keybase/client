# Mobile Chat Thread → LegendList Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile chat thread's inverted `FlatList` + `renderScrollComponent={KeyboardChatScrollView}` with `KeyboardChatLegendList` from `@legendapp/list/keyboard-chat`, matching the desktop LegendList implementation.

**Architecture:** Switch from an inverted list (reversed ordinals, `KeyboardChatScrollView` as a render-prop scroll component) to a non-inverted `KeyboardChatLegendList` with natural ordinal order. Scroll stability is handled by `maintainScrollAtEnd` + `maintainVisibleContentPosition`. Separators move inline into `renderItem` (same pattern as desktop's `HighlightableRow`) because LegendList's `ItemSeparatorComponent` only exposes `leadingItem`, and non-inverted means we need the trailing-item ordinal for the orange-line logic.

**Tech Stack:** `@legendapp/list/keyboard-chat` (`KeyboardChatLegendList`), `react-native-reanimated`, existing thread context hooks.

**Base branch:** `nojima/HOTPOT-next-670-clean-2` (not `master`). Run `gh pr view --json baseRefName` before any `git diff` or comparison.

**Working directory:** Always `cd shared/` first. Validate after every TypeScript change with `yarn lint` then `yarn tsc`.

---

## File Map

| File | Change |
|------|--------|
| `shared/chat/conversation/messages/separator.tsx` | Remove `isMobile ? leadingItem : trailingItem` — always use `trailingItem` |
| `shared/chat/conversation/list-area/index.tsx` | Rewrite `NativeConversationList`; remove helpers `useInvertedMessageOrdinals`, `useNativeSafeOnViewableItemsChanged`, `useNativeScrolling`, `RNFlatListRef`; clean dead imports |
| `shared/chat/conversation/messages/special-top-message.tsx` | Remove mobile-only separator block (now handled inline by `NativeMobileRow`) |

---

### Task 1: Update separator to always use `trailingItem`

The separator currently branches on `isMobile` because the inverted FlatList flipped which side of the separator held the "next" message. Non-inverted LegendList matches desktop: the separator renders above its row, so `trailingItem` (the current row's ordinal) is always correct.

**Files:**
- Modify: `shared/chat/conversation/messages/separator.tsx:17`

- [ ] **Step 1: Edit separator.tsx**

Change line 17 from:
```tsx
  const ordinal = isMobile ? leadingItem : trailingItem
```
to:
```tsx
  const ordinal = trailingItem
```

- [ ] **Step 2: Validate**

```bash
cd shared && yarn lint --quiet 2>&1 | head -30 && yarn tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to separator.tsx.

- [ ] **Step 3: Commit**

```bash
cd shared && git add chat/conversation/messages/separator.tsx
git commit -m "separator: always use trailingItem now that mobile list is non-inverted"
```

---

### Task 2: Rewrite NativeConversationList with KeyboardChatLegendList

Replace the full mobile section of `index.tsx`. The new component mirrors the desktop `DesktopThreadWrapper` structure: stable-ref callbacks, a memoized row component that inlines the separator, `onViewableItemsChanged` for older-message loading (first 3 items visible → load), `onEndReached` for newer-message loading (only when `!containsLatestMessage`), and `KeyboardChatLegendList` with `initialScrollAtEnd` / `maintainScrollAtEnd` / `maintainVisibleContentPosition`.

**Files:**
- Modify: `shared/chat/conversation/list-area/index.tsx`

- [ ] **Step 1: Replace the imports block**

Remove these imports (no longer needed):
```tsx
import {FlatList} from 'react-native'
import type {ScrollViewProps} from 'react-native'
import {usingFlashList} from './flashlist-config'
import {mobileTypingContainerHeight} from '../input-area/normal/typing'
import {KeyboardChatScrollView} from 'react-native-keyboard-controller'
```

Add this import:
```tsx
import {KeyboardChatLegendList} from '@legendapp/list/keyboard-chat'
```

Keep all existing imports (LegendList from `@legendapp/list/react`, `useConversationThreadLoadNewerMessagesDueToScroll`, `useSafeAreaInsets`, `sortedIndexOf`, etc.).

- [ ] **Step 2: Replace the entire native section**

Delete everything from the comment `// ==================== NATIVE ====================` down to (but not including) the final `export default` line, and replace with:

```tsx
// ==================== NATIVE ====================

const NativeMobileRow = React.memo(({ordinal}: {ordinal: T.Chat.Ordinal}) => {
  const {centeredHighlightOrdinal} = useConversationCenter()
  return (
    <>
      <Separator trailingItem={ordinal} />
      <MessageRow isCenteredHighlight={centeredHighlightOrdinal === ordinal} ordinal={ordinal} />
    </>
  )
})
NativeMobileRow.displayName = 'NativeMobileRow'

const NativeConversationList = function NativeConversationList() {
  const conversationIDKey = useConversationThreadID()
  const data = useConversationThreadSelector(
    C.useShallow(s => ({
      containsLatestMessage: !s.moreToLoadForward,
      loaded: s.loaded,
      messageOrdinals: s.messageOrdinals ?? noOrdinals,
    }))
  )
  const {centeredOrdinal} = useConversationCenter()
  const {containsLatestMessage, loaded, messageOrdinals} = data

  const listRef = React.useRef<LegendListRef | null>(null)
  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions()
  const loadOlderMessagesDueToScroll = useConversationThreadLoadOlderMessagesDueToScroll()
  const loadNewerMessagesDueToScroll = useConversationThreadLoadNewerMessagesDueToScroll()
  const getThreadLoadStatusOptions = useThreadLoadStatusOptionsGetter()
  const threadStore = useConversationThreadStore()
  const insets = useSafeAreaInsets()

  // Stable refs for values used inside stable callbacks
  const containsLatestMessageRef = React.useRef(containsLatestMessage)
  React.useEffect(() => {
    containsLatestMessageRef.current = containsLatestMessage
  }, [containsLatestMessage])

  const numOrdinalsRef = React.useRef(messageOrdinals.length)
  React.useEffect(() => {
    numOrdinalsRef.current = messageOrdinals.length
  }, [messageOrdinals.length])

  const messageOrdinalsRef = React.useRef(messageOrdinals)
  React.useEffect(() => {
    messageOrdinalsRef.current = messageOrdinals
  }, [messageOrdinals])

  const getItemType = React.useCallback(
    (ordinal: T.Chat.Ordinal) => {
      const {messageMap, messageTypeMap} = threadStore.getState()
      const message = messageMap.get(ordinal)
      return message ? getMessageRowType(message, messageTypeMap.get(ordinal)) : (messageTypeMap.get(ordinal) ?? 'text')
    },
    [threadStore]
  )

  const scrollToBottom = React.useCallback(() => {
    void listRef.current?.scrollToEnd({animated: false})
  }, [])

  const {setScrollRef} = React.useContext(ScrollContext)
  React.useEffect(() => {
    setScrollRef({scrollDown: noop, scrollToBottom, scrollUp: noop})
  }, [setScrollRef, scrollToBottom])

  // Load older messages when scrolled near the top (first 3 items visible)
  const onViewableItemsChanged = C.useDebouncedCallback(
    ({viewableItems}: {viewableItems: Array<{index: number; item: T.Chat.Ordinal}>}) => {
      if ((viewableItems[0]?.index ?? Infinity) < 3) {
        loadOlderMessagesDueToScroll(numOrdinalsRef.current, getThreadLoadStatusOptions())
      }
    },
    200
  )

  // Load newer messages when scrolled to the end (only when not at latest)
  const onEndReached = C.useThrottledCallback(() => {
    if (!containsLatestMessageRef.current) {
      loadNewerMessagesDueToScroll(numOrdinalsRef.current, getThreadLoadStatusOptions())
    }
  }, 200)

  React.useEffect(
    () => () => {
      onEndReached.cancel()
    },
    [onEndReached]
  )

  // Scroll to centered ordinal when it changes (search / thread navigation)
  const lastScrolledCenteredRef = React.useRef<T.Chat.Ordinal | undefined>(undefined)
  React.useLayoutEffect(() => {
    lastScrolledCenteredRef.current = undefined
  }, [conversationIDKey])

  React.useEffect(() => {
    if (!loaded) return
    if (centeredOrdinal !== undefined) {
      if (lastScrolledCenteredRef.current === centeredOrdinal) return
      const idx = sortedIndexOf(
        messageOrdinalsRef.current as unknown as number[],
        centeredOrdinal as unknown as number
      )
      if (idx < 0) return
      lastScrolledCenteredRef.current = centeredOrdinal
      void listRef.current?.scrollToIndex({animated: false, index: idx, viewPosition: 0.5})
    } else if (lastScrolledCenteredRef.current !== undefined) {
      lastScrolledCenteredRef.current = undefined
      if (containsLatestMessage) {
        void listRef.current?.scrollToEnd({animated: false})
      }
    }
  }, [centeredOrdinal, loaded, containsLatestMessage, messageOrdinals])

  // Mark thread as read after initial load (once per conversation)
  const markedReadRef = React.useRef(false)
  React.useLayoutEffect(() => {
    markedReadRef.current = false
  }, [conversationIDKey])

  const onLoad = React.useCallback(() => {
    if (!markedReadRef.current) {
      markedReadRef.current = true
      markInitiallyLoadedThreadAsRead()
    }
  }, [markInitiallyLoadedThreadAsRead])

  const renderItem = React.useCallback(
    ({item: ordinal}: {item: T.Chat.Ordinal}) => <NativeMobileRow ordinal={ordinal} />,
    []
  )

  const jumpToRecent = Hooks.useJumpToRecent(scrollToBottom, messageOrdinals.length)

  const _centeredIdx =
    centeredOrdinal !== undefined
      ? sortedIndexOf(messageOrdinals as unknown as number[], centeredOrdinal as unknown as number)
      : -1
  const initialScrollIndex =
    _centeredIdx >= 0 ? {index: _centeredIdx, viewPosition: 0.5 as const} : undefined

  return (
    <Kb.ErrorBoundary>
      <PerfProfiler id="MessageList">
        <Kb.Box2 direction="vertical" fullWidth={true} flex={1} relative={true}>
          <KeyboardChatLegendList
            key={conversationIDKey}
            ref={listRef}
            data={messageOrdinals as unknown as T.Chat.Ordinal[]}
            renderItem={renderItem}
            keyExtractor={(ordinal: T.Chat.Ordinal) => String(ordinal)}
            getItemType={getItemType}
            ListHeaderComponent={SpecialTopMessage}
            ListFooterComponent={SpecialBottomMessage}
            recycleItems={true}
            drawDistance={250}
            estimatedItemSize={72}
            initialScrollAtEnd={initialScrollIndex === undefined}
            initialScrollIndex={initialScrollIndex}
            maintainScrollAtEnd={centeredOrdinal !== undefined ? false : {on: {dataChange: true}}}
            maintainVisibleContentPosition={centeredOrdinal !== undefined ? undefined : {data: true}}
            onLoad={onLoad}
            onEndReached={onEndReached}
            onViewableItemsChanged={onViewableItemsChanged as unknown as (info: unknown) => void}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            offset={insets.bottom}
            testID="messageList"
          />
          {jumpToRecent}
        </Kb.Box2>
      </PerfProfiler>
    </Kb.ErrorBoundary>
  )
}
```

- [ ] **Step 3: Remove now-dead helpers and clean imports**

After replacing the native section, search the file for references to these and remove them if they no longer appear anywhere:

- `useInvertedMessageOrdinals` function definition (was below the native comment)
- `useNativeSafeOnViewableItemsChanged` function definition
- `useNativeScrolling` function definition
- `RNFlatListRef` type definition
- `minTimeDelta` and `minDistanceFromEnd` constants
- `maintainVisibleContentPosition` constant (the old `{autoscrollToTopThreshold: 1, minIndexForVisible: 0}` one)

Also verify the import for `useConversationThreadLoadNewerMessagesDueToScroll` is present (it was already imported for desktop but double-check).

- [ ] **Step 4: Validate**

```bash
cd shared && yarn lint --quiet 2>&1 | head -40 && yarn tsc --noEmit 2>&1 | head -40
```

Expected: no errors. Fix any type errors before proceeding.

- [ ] **Step 5: Commit**

```bash
cd shared && git add chat/conversation/list-area/index.tsx
git commit -m "mobile chat thread: replace inverted FlatList with KeyboardChatLegendList"
```

---

### Task 3: Remove stale mobile separator from SpecialTopMessage

`special-top-message.tsx` renders a special separator just for the inverted FlatList case (to show the orange line above the very first message). With non-inverted LegendList, `NativeMobileRow` handles this inline for every row including the first.

**Files:**
- Modify: `shared/chat/conversation/messages/special-top-message.tsx`

- [ ] **Step 1: Remove the conditional separator block**

Find and delete these lines (around line 181–184):
```tsx
      {!isMobile || usingFlashList ? null : (
        // special case here with the sep. The flatlist and flashlist invert the leading-trailing, see useStateFast
        <Separator trailingItem={T.Chat.numberToOrdinal(0)} leadingItem={firstOrdinal} />
      )}
```

Also remove the now-unused import at the top:
```tsx
import {usingFlashList} from '../list-area/flashlist-config'
```

And remove the `Separator` import if it becomes unused after this deletion (check if it's used elsewhere in the file).

- [ ] **Step 2: Validate**

```bash
cd shared && yarn lint --quiet 2>&1 | head -40 && yarn tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd shared && git add chat/conversation/messages/special-top-message.tsx
git commit -m "special-top-message: remove stale mobile inverted-list separator"
```
