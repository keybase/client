import * as C from '@/constants'
import * as React from 'react'
import type * as T from '@/constants/types'
import type {ChatInboxRowItem} from './rowitem'

export type RowItem = ChatInboxRowItem

// Minimal shape that both @legendapp/list/react and @legendapp/list/react-native ViewToken satisfy
export type ViewableItem = {index: number; item: RowItem}
export type ViewableItemsData = {viewableItems: ReadonlyArray<ViewableItem>; changed: ReadonlyArray<ViewableItem>}

export const viewabilityConfig = {
  minimumViewTime: 100,
  viewAreaCoveragePercentThreshold: 30,
}

export const getItemType = (item: RowItem) => item.type

export const keyExtractor = (item: RowItem, idx: number) => {
  switch (item.type) {
    case 'divider':
    case 'teamBuilder':
      return item.type
    case 'small':
    case 'big':
      return item.conversationIDKey
    case 'bigHeader':
      return item.teamname
    default:
      return String(idx)
  }
}

const calcUnreadShortcut = (unreadIndices: ReadonlyMap<number, number>, lastVisibleIdx: number) => {
  if (!unreadIndices.size || lastVisibleIdx < 0) {
    return {firstOffscreenIdx: -1, showUnread: false, unreadCount: 0}
  }
  let unreadCount = 0
  let firstOffscreenIdx = 0
  unreadIndices.forEach((count, idx) => {
    if (idx > lastVisibleIdx) {
      if (firstOffscreenIdx <= 0) firstOffscreenIdx = idx
      unreadCount += count
    }
  })
  return firstOffscreenIdx
    ? {firstOffscreenIdx, showUnread: true, unreadCount}
    : {firstOffscreenIdx: -1, showUnread: false, unreadCount: 0}
}

// Compute divider Y offset from known item sizes, avoiding LegendList's internal
// positions array which is lazily recomputed after data changes.
const getDividerYOffset = (rows: ArrayLike<RowItem>, getSize: (item: RowItem) => number): number => {
  let offset = 0
  for (let i = 0; i < rows.length; i++) {
    const item = rows[i]!
    if (item.type !== 'small') return offset
    offset += getSize(item)
  }
  return -1
}

const shouldShowFloating = (
  rows: ArrayLike<RowItem>,
  getSize: (item: RowItem) => number,
  listRef: React.RefObject<{getState: () => {scroll: number; scrollLength: number}} | null>
): boolean => {
  const state = listRef.current?.getState()
  if (!state || state.scrollLength <= 0) return false
  const dividerY = getDividerYOffset(rows, getSize)
  if (dividerY < 0) return false
  return dividerY > state.scroll + state.scrollLength
}

export function useUnreadShortcut(p: {
  rows: ReadonlyArray<RowItem>
  unreadIndices: ReadonlyMap<number, number>
  unreadTotal: number
  getSize: (item: RowItem) => number
  listRef: React.RefObject<{
    getState: () => {end: number; scroll: number; scrollLength: number}
    scrollToIndex: (params: {animated?: boolean; index: number; viewPosition?: number}) => Promise<void>
  } | null>
}) {
  const {rows, unreadIndices, unreadTotal, getSize, listRef} = p
  const [showFloating, setShowFloating] = React.useState(false)
  const [showUnread, setShowUnread] = React.useState(false)
  const [unreadCount, setUnreadCount] = React.useState(0)
  const firstOffscreenIdxRef = React.useRef(-1)

  // Captures latest rows/getSize/etc. — recreated when deps change.
  const applyImpl = React.useCallback(() => {
    const state = listRef.current?.getState()
    const lastVisibleIdx = state?.end ?? -1
    const info = calcUnreadShortcut(unreadIndices, lastVisibleIdx)
    setShowUnread(info.showUnread)
    setUnreadCount(info.unreadCount)
    firstOffscreenIdxRef.current = info.firstOffscreenIdx
    setShowFloating(shouldShowFloating(rows, getSize, listRef))
  }, [listRef, unreadIndices, rows, getSize])

  // Always points to the latest applyImpl. Updated in a layout effect so it's
  // current before any post-paint callbacks (e.g. the 100ms minimumViewTime timeout
  // in LegendList's onViewableItemsChanged) fire.
  const applyRef = React.useRef(applyImpl)
  React.useLayoutEffect(() => {
    applyRef.current = applyImpl
  })

  // Stable function safe to use in onViewChanged — avoids stale closure issue where
  // LegendList's minimumViewTime setTimeout fires with an old callback capturing old rows.
  const applyUnreadAndFloating = React.useCallback(() => applyRef.current(), [])

  const scrollToUnread = () => {
    if (firstOffscreenIdxRef.current <= 0) {
      return
    }
    void listRef.current?.scrollToIndex({animated: true, index: firstOffscreenIdxRef.current, viewPosition: 0.5})
  }

  // Re-run when data changes (rows, unreadIndices, unreadTotal).
  React.useEffect(() => {
    applyImpl()
  }, [applyImpl, unreadTotal])

  return {applyUnreadAndFloating, scrollToUnread, showFloating, showUnread, unreadCount}
}

export function useScrollUnbox(
  onUntrustedInboxVisible: (ids: Array<T.Chat.ConversationIDKey>) => void,
  debounceMs: number
) {
  return C.useDebouncedCallback(
    (data: ViewableItemsData) => {
      const toUnbox = data.viewableItems.reduce<Array<T.Chat.ConversationIDKey>>((arr, vi) => {
        const r = vi.item
        if ((r.type === 'small' || r.type === 'big') && r.conversationIDKey) {
          arr.push(r.conversationIDKey)
        }
        return arr
      }, [])
      onUntrustedInboxVisible(toUnbox)
    },
    debounceMs
  )
}
