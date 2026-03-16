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

const shouldShowFloating = (rows: ArrayLike<RowItem>, lastVisibleIdx: number): boolean => {
  if (lastVisibleIdx < 0) return false
  // Find the first non-small row (the divider). Show floating if it's beyond the last visible index.
  // This is invariant to row shifts: when small teams expand, the divider moves right, so
  // lastVisibleIdx < dividerIdx becomes true even without a new scroll event.
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]?.type !== 'small') return lastVisibleIdx < i
  }
  return false
}

export function useUnreadShortcut(p: {
  rows: ReadonlyArray<RowItem>
  unreadIndices: ReadonlyMap<number, number>
  unreadTotal: number
  listRef: React.RefObject<{
    getState: () => {end: number}
    scrollToIndex: (params: {animated?: boolean; index: number; viewPosition?: number}) => Promise<void>
  } | null>
}) {
  const {rows, unreadIndices, unreadTotal, listRef} = p
  const [showFloating, setShowFloating] = React.useState(false)
  const [showUnread, setShowUnread] = React.useState(false)
  const [unreadCount, setUnreadCount] = React.useState(0)
  const firstOffscreenIdxRef = React.useRef(-1)
  const rowsRef = React.useRef(rows)
  rowsRef.current = rows

  const applyUnreadAndFloating = () => {
    const lastVisibleIdx = listRef.current?.getState().end ?? -1
    const info = calcUnreadShortcut(unreadIndices, lastVisibleIdx)
    setShowUnread(info.showUnread)
    setUnreadCount(info.unreadCount)
    firstOffscreenIdxRef.current = info.firstOffscreenIdx
    const floating = shouldShowFloating(rowsRef.current, lastVisibleIdx)
    console.log('[floating] apply lastVisible:', lastVisibleIdx, 'rows.length:', rowsRef.current.length, 'result:', floating)
    setShowFloating(floating)
  }

  const scrollToUnread = () => {
    if (firstOffscreenIdxRef.current <= 0) {
      return
    }
    void listRef.current?.scrollToIndex({animated: true, index: firstOffscreenIdxRef.current, viewPosition: 0.5})
  }

  React.useEffect(() => {
    applyUnreadAndFloating()
  }, [unreadIndices, unreadTotal, rows])

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
