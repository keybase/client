// @flow
import * as Types from '../../constants/types/fs'
import * as Flow from '../../util/flow'
import {memoize} from 'lodash-es'

export type SortableTlfTypeRowItem = Types.TlfTypeRowItem & {
  type: 'folder',
}

export type SortableTlfRowItem = Types.TlfRowItem & {
  type: 'folder',
  isNew: boolean,
}

export type SortableStillRowItem = Types.StillRowItem & {
  type: Types.PathType,
  lastModifiedTimestamp: number,
}
export type SortableEditingRowItem = Types.EditingRowItem & {
  rowType: 'editing',
  editType: Types.EditType,
  type: Types.PathType,
}
export type SortableUploadingRowItem = Types.UploadingRowItem & {
  rowType: 'uploading',
  type: Types.PathType,
}
export type SortableRowItem =
  | SortableStillRowItem
  | SortableEditingRowItem
  | SortableUploadingRowItem
  | SortableTlfTypeRowItem
  | SortableTlfRowItem

type PathItemComparer = (a: SortableRowItem, b: SortableRowItem) => number

const getLastModifiedTimeStamp = (a: SortableRowItem) =>
  a.rowType === 'still' ? a.lastModifiedTimestamp : Date.now()

// This handles comparisons that aren't affected by asc/desc setting.
const getCommonComparer = memoize(
  (meUsername?: string) => (a: SortableRowItem, b: SortableRowItem): number => {
    // See if any of them are newly created folders.
    const aIsNewFolder = a.rowType === 'editing' && a.editType === 'new-folder'
    const bIsNewFolder = b.rowType === 'editing' && b.editType === 'new-folder'
    if (aIsNewFolder && !bIsNewFolder) {
      return -1
    }
    if (!aIsNewFolder && bIsNewFolder) {
      return 1
    }

    if (a.rowType === 'tlf' && b.rowType === 'tlf') {
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

const getComparerBySortBy = (sortBy: Types.SortBy): PathItemComparer => {
  switch (sortBy) {
    case 'name':
      return (a: SortableRowItem, b: SortableRowItem): number => {
        // If different type, folder goes first.
        if (a.type === 'folder' && b.type !== 'folder') {
          return -1
        }
        if (a.type !== 'folder' && b.type === 'folder') {
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

const editingRowItemTieBreaker = (a: SortableRowItem, b: SortableRowItem): number => {
  if (a.rowType !== 'editing' || b.rowType !== 'editing') {
    return 0
  }
  return Types.editIDToString(a.editID).localeCompare(Types.editIDToString(b.editID))
}

const getComparer = ({sortBy, sortOrder}: Types.SortSetting, meUsername?: string) => (
  a: SortableRowItem,
  b: SortableRowItem
): number => {
  const commonCompare = getCommonComparer(meUsername)(a, b)
  if (commonCompare !== 0) {
    return commonCompare
  }

  const multiplier = sortOrder === 'desc' ? -1 : 1

  const sortByCompare = getComparerBySortBy(sortBy)(a, b)
  if (sortByCompare !== 0) {
    return sortByCompare * multiplier
  }

  const tieBroken = editingRowItemTieBreaker(a, b)
  return tieBroken * multiplier
}

export const sortRowItems = (
  items: Array<SortableRowItem>,
  sortSetting: Types.SortSetting,
  username?: string
): Array<SortableRowItem> => {
  return items.sort(getComparer(sortSetting, username))
}
