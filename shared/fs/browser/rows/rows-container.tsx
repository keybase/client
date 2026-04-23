import * as C from '@/constants'
import * as T from '@/constants/types'
import * as RowTypes from './types'
import {sortRowItems, type SortableRowItem} from './sort'
import Rows, {type Props} from './rows'
import {asRows as topBarAsRow} from '../../top-bar'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'
import {useCurrentUserState} from '@/stores/current-user'
import {useFsBrowserEdits, type BrowserEditSession} from '../edit-state'
import {useFsFolderChildItems, useFsTlfs} from '../../common'

type OwnProps = {
  destinationPickerSource?: T.FS.MoveOrCopySource | T.FS.IncomingShareSource
  filter?: string
  path: T.FS.Path // path to the parent folder containering the rows,
  headerRows?: Array<RowTypes.HeaderRowItem>
}

const getStillRows = (
  childItems: ReadonlyArray<T.Immutable<T.FS.PathItem>>,
  childPaths: ReadonlyArray<T.Immutable<T.FS.Path>>
): Array<RowTypes.StillRowItem> =>
  childItems.reduce<Array<RowTypes.StillRowItem>>((items, item, index) => {
    const path = childPaths[index]
    if (!path) {
      return items
    }
    return [
      ...items,
      {
        key: `still:${item.name}`,
        lastModifiedTimestamp: item.lastModifiedTimestamp,
        name: item.name,
        path,
        // fields for sortable
        rowType: RowTypes.RowType.Still,
        type: item.type,
      },
    ]
  }, [])

const _getPlaceholderRows = (
  type: T.FS.PathType.File | T.FS.PathType.Folder
): Array<RowTypes.PlaceholderRowItem> => [
  {key: 'placeholder:1', name: '1', rowType: RowTypes.RowType.Placeholder, type},
  {key: 'placeholder:2', name: '2', rowType: RowTypes.RowType.Placeholder, type},
  {key: 'placeholder:3', name: '3', rowType: RowTypes.RowType.Placeholder, type},
]
const filePlaceholderRows = _getPlaceholderRows(T.FS.PathType.File)
const folderPlaceholderRows = _getPlaceholderRows(T.FS.PathType.Folder)

const _makeInTlfRows = (
  parentPath: T.Immutable<T.FS.Path>,
  editSessions: ReadonlyMap<T.FS.EditID, BrowserEditSession>,
  stillRows: T.Immutable<Array<RowTypes.StillRowItem>>
) => {
  const relevantEdits = [...editSessions.values()].filter(({edit}) => edit.parentPath === parentPath)
  const newFolderRows: Array<SortableRowItem> = relevantEdits
    .filter(({edit}) => edit.type === T.FS.EditType.NewFolder)
    .map(editSession => ({
      editSession,
      key: `edit:${T.FS.editIDToString(editSession.editID)}`,
      name: editSession.edit.name,
      // fields for sortable
      rowType: RowTypes.RowType.NewFolder,
      type: T.FS.PathType.Folder,
    }))
  const renameEdits = new Map(
    relevantEdits
      .filter(({edit}) => edit.type === T.FS.EditType.Rename)
      .map(editSession => [editSession.edit.originalName, editSession] as const)
  )
  return newFolderRows.concat(
    stillRows.map(row =>
      renameEdits.has(row.name)
        ? {
            ...row,
            editSession: renameEdits.get(row.name),
          }
        : row
    )
  )
}

const getInTlfItems = (
  pathItem: T.FS.PathItem,
  childItems: ReadonlyArray<T.FS.PathItem>,
  childPaths: ReadonlyArray<T.FS.Path>,
  sortSetting: T.FS.SortSetting,
  path: T.FS.Path,
  editSessions: ReadonlyMap<T.FS.EditID, BrowserEditSession>
): Array<RowTypes.NamedRowItem> => {
  if (pathItem.type !== T.FS.PathType.Folder) {
    return filePlaceholderRows
  }

  if (pathItem.progress === T.FS.ProgressType.Pending) {
    return filePlaceholderRows
  }

  const stillRows = getStillRows(childItems, childPaths)
  return sortRowItems(_makeInTlfRows(path, editSessions, stillRows), sortSetting, '')
}

const getTlfRowsFromTlfs = (
  tlfs: T.Immutable<Map<string, T.FS.Tlf>>,
  tlfType: T.Immutable<T.FS.TlfType>,
  username: string,
  inDestinationPicker?: boolean
): Array<SortableRowItem> =>
  [...tlfs]
    .filter(([_, {isIgnored}]) => !isIgnored)
    .map(([name, {isNew, tlfMtime}]) => ({
      disabled: FS.hideOrDisableInDestinationPicker(tlfType, name, username, inDestinationPicker),
      isNew,
      key: `tlf:${name}`,
      name,
      rowType: RowTypes.RowType.Tlf,
      tlfMtime,
      tlfType,
      type: T.FS.PathType.Folder,
    }))

const getTlfItems = (
  tlfs: T.FS.Tlfs,
  sortSetting: T.FS.SortSetting,
  username: string,
  path: T.FS.Path,
  inDestinationPicker?: boolean
): Array<RowTypes.NamedRowItem> => {
  if (tlfs.private.size === 0) {
    // /keybase/private/<me> is always favorited. If it's not there it must be
    // unintialized.
    return folderPlaceholderRows
  }

  const {tlfList, tlfType} = FS.getTlfListAndTypeFromPath(tlfs, path)

  return sortRowItems(
    getTlfRowsFromTlfs(tlfList, tlfType, username, inDestinationPicker),
    sortSetting,
    (T.FS.pathIsNonTeamTLFList(path) && username) || ''
  )
}

const getNormalRowItems = ({
  childItems,
  childPaths,
  editSessions,
  path,
  pathItem,
  sortSetting,
  tlfs,
  username,
  inDestinationPicker,
}: {
  childItems: ReadonlyArray<T.FS.PathItem>
  childPaths: ReadonlyArray<T.FS.Path>
  editSessions: ReadonlyMap<T.FS.EditID, BrowserEditSession>
  inDestinationPicker?: boolean
  path: T.FS.Path
  pathItem: T.FS.PathItem
  sortSetting: T.FS.SortSetting
  tlfs: T.FS.Tlfs
  username: string
}): Array<RowTypes.NamedRowItem> => {
  const level = T.FS.getPathLevel(path)
  switch (level) {
    case 0:
    case 1:
      return [] // should never happen
    case 2:
      return getTlfItems(tlfs, sortSetting, username, path, inDestinationPicker)
    default:
      return getInTlfItems(pathItem, childItems, childPaths, sortSetting, path, editSessions)
  }
}

const filterable = new Set([RowTypes.RowType.TlfType, RowTypes.RowType.Tlf, RowTypes.RowType.Still])
const filterRowItems = (rows: Array<RowTypes.NamedRowItem>, filter?: string) =>
  filter
    ? rows.filter(
        row => !filterable.has(row.rowType) || row.name.toLowerCase().includes(filter.toLowerCase())
      )
    : rows

const Container = (o: OwnProps) => {
  const {childItems, childPaths, pathItem} = useFsFolderChildItems(o.path)
  const tlfs = useFsTlfs()
  const sortSetting = useFSState(s => FS.getPathUserSetting(s.pathUserSettings, o.path).sort)
  const _username = useCurrentUserState(s => s.username)
  const browserEdits = useFsBrowserEdits()
  const editSessions: ReadonlyMap<T.FS.EditID, BrowserEditSession> = browserEdits?.edits ?? new Map()
  const inDestinationPicker = !!o.destinationPickerSource

  const normalRowItems = getNormalRowItems({
    childItems,
    childPaths,
    editSessions,
    inDestinationPicker,
    path: o.path,
    pathItem,
    sortSetting,
    tlfs,
    username: _username,
  })
  const filteredRowItems = filterRowItems(normalRowItems, o.filter)
  const props = {
    destinationPickerSource: o.destinationPickerSource,
    emptyMode: !normalRowItems.length
      ? 'empty'
      : !filteredRowItems.length
        ? 'not-empty-but-no-match'
        : ('not-empty' as Props['emptyMode']),
    items: [
      ...(o.headerRows || []),
      // don't show top bar in destinationPicker.
      ...(inDestinationPicker ? [] : topBarAsRow(o.path)),
      ...filteredRowItems,
      ...// If we are in the destination picker, inject two empty rows so when
      // user scrolls to the bottom nothing is blocked by the
      // semi-transparent footer.
      //
      // TODO: add `footerRows` and inject these from destination-picker, so that
      // Rows componenet don't need to worry about whether it's in
      // destinationPicker mode or not.
      (!C.isMobile && inDestinationPicker
        ? [
            {key: 'empty:0', rowType: RowTypes.RowType.Empty} as RowTypes.EmptyRowItem,
            {key: 'empty:1', rowType: RowTypes.RowType.Empty} as RowTypes.EmptyRowItem,
          ]
        : []),
    ],
    path: o.path,
  }
  return <Rows {...props} />
}

export default Container
