import type {ChatInboxRowItem} from './rowitem'

export type RowItem = ChatInboxRowItem

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

export const calcUnreadShortcut = (unreadIndices: ReadonlyMap<number, number>, lastVisibleIdx: number) => {
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

export const shouldShowFloating = (rows: ArrayLike<RowItem>, lastVisibleIdx: number) =>
  lastVisibleIdx >= 0 && rows[lastVisibleIdx]?.type === 'small'
