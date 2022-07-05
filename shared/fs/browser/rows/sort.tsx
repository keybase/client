import * as Types from '../../../constants/types/fs'
import * as RowTypes from './types'
import * as Flow from '../../../util/flow'
import {memoize} from '../../../util/memoize'
import logger from '../../../logger'

export type SortableRowItem = RowTypes.StillRowItem | RowTypes.NewFolderRowItem | RowTypes.TlfRowItem

type PathItemComparer = (a: SortableRowItem, b: SortableRowItem) => number

const getSortBy = (sortSetting: Types.SortSetting) =>
  sortSetting === Types.SortSetting.NameAsc || sortSetting === Types.SortSetting.NameDesc ? 'name' : 'time'
const getOrder = (sortSetting: Types.SortSetting) =>
  sortSetting === Types.SortSetting.NameAsc || sortSetting === Types.SortSetting.TimeAsc ? 'asc' : 'desc'

const getLastModifiedTimeStamp = (a: SortableRowItem) =>
  a.rowType === RowTypes.RowType.Still
    ? a.lastModifiedTimestamp
    : a.rowType === RowTypes.RowType.Tlf
    ? a.tlfMtime
    : Date.now()

// This handles comparisons that aren't affected by asc/desc setting.
const getCommonComparer = memoize(
  (meUsername: string) => (a: SortableRowItem, b: SortableRowItem): number => {
    // See if any of them are newly created folders.
    const aIsNewFolder = a.rowType === RowTypes.RowType.NewFolder
    const bIsNewFolder = b.rowType === RowTypes.RowType.NewFolder
    if (aIsNewFolder && !bIsNewFolder) {
      return -1
    }
    if (!aIsNewFolder && bIsNewFolder) {
      return 1
    }

    if (a.rowType === RowTypes.RowType.Tlf && b.rowType === RowTypes.RowType.Tlf) {
      // Both are TLFs.

      // First, if meUsername is set (i.e. user logged in), try to put user's
      // own TLF at first.
      if (meUsername) {
        const aIsMe = a.name === meUsername
        const bIsMe = b.name === meUsername
        if (aIsMe && !bIsMe) {
          return -1
        }
        if (!aIsMe && bIsMe) {
          return 1
        }
      }

      // Then, inspect if any of them has isNew set. This only applies to TLF
      // lists.
      if (a.isNew && !b.isNew) {
        return -1
      }
      if (!a.isNew && b.isNew) {
        return 1
      }
    }

    return 0
  }
)

const getComparerBySortBy = (sortBy: 'name' | 'time'): PathItemComparer => {
  switch (sortBy) {
    case 'name':
      return (a: SortableRowItem, b: SortableRowItem): number => {
        // If different type, folder goes first.
        if (a.type === Types.PathType.Folder && b.type !== Types.PathType.Folder) {
          return -1
        }
        if (a.type !== Types.PathType.Folder && b.type === Types.PathType.Folder) {
          return 1
        }

        return a.name.localeCompare(b.name)
      }
    case 'time':
      // asc === recent first, i.e. larger first
      return (a: SortableRowItem, b: SortableRowItem): number =>
        getLastModifiedTimeStamp(b) - getLastModifiedTimeStamp(a)
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(sortBy)
      throw new Error('invalid SortBy: ' + sortBy)
  }
}

const getComparer = (sortSetting: Types.SortSetting, meUsername: string) => (
  a: SortableRowItem,
  b: SortableRowItem
): number => {
  const commonCompare = getCommonComparer(meUsername)(a, b)
  if (commonCompare !== 0) {
    return commonCompare
  }

  const multiplier = getOrder(sortSetting) === 'desc' ? -1 : 1

  const sortByCompare = getComparerBySortBy(getSortBy(sortSetting))(a, b)
  return sortByCompare * multiplier
}

export const sortRowItems: (
  items: Array<SortableRowItem>,
  sortSetting: Types.SortSetting,
  username: string
) => Array<SortableRowItem> = memoize((items, sortSetting, username) => {
  logger.debug('sortRowItems')
  return items.sort(getComparer(sortSetting, username))
})
