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

type OwnProps = {
  destinationPickerSource?: T.FS.MoveOrCopySource | T.FS.IncomingShareSource
  filter?: string
  path: T.FS.Path // path to the parent folder containering the rows,
  headerRows?: Array<RowTypes.HeaderRowItem>
}

const getStillRows = (
  pathItems: T.Immutable<Map<T.FS.Path, T.FS.PathItem>>,
  parentPath: T.Immutable<T.FS.Path>,
  names: ReadonlySet<string>
): Array<RowTypes.StillRowItem> =>
  [...names].reduce<Array<RowTypes.StillRowItem>>((items, name) => {
    const item = FS.getPathItem(pathItems, T.FS.pathConcat(parentPath, name))
    const path = T.FS.pathConcat(parentPath, item.name)
    return [
      ...items,
      {
        key: `still:${name}`,
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

const getInTlfItemsFromStateProps = (
  stateProps: StateProps,
  path: T.FS.Path,
  editSessions: ReadonlyMap<T.FS.EditID, BrowserEditSession>
): Array<RowTypes.NamedRowItem> => {
  const _pathItem = FS.getPathItem(stateProps._pathItems, path)
  if (_pathItem.type !== T.FS.PathType.Folder) {
    return filePlaceholderRows
  }

  if (_pathItem.progress === T.FS.ProgressType.Pending) {
    return filePlaceholderRows
  }

  const stillRows = getStillRows(stateProps._pathItems, path, _pathItem.children)
  return sortRowItems(_makeInTlfRows(path, editSessions, stillRows), stateProps._sortSetting, '')
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

type StateProps = {
  _pathItems: T.FS.PathItems
  _sortSetting: T.FS.SortSetting
  _tlfs: T.FS.Tlfs
  _username: string
}

const getTlfItemsFromStateProps = (
  stateProps: StateProps,
  path: T.FS.Path,
  inDestinationPicker?: boolean
): Array<RowTypes.NamedRowItem> => {
  if (stateProps._tlfs.private.size === 0) {
    // /keybase/private/<me> is always favorited. If it's not there it must be
    // unintialized.
    return folderPlaceholderRows
  }

  const {tlfList, tlfType} = FS.getTlfListAndTypeFromPath(stateProps._tlfs, path)

  return sortRowItems(
    getTlfRowsFromTlfs(tlfList, tlfType, stateProps._username, inDestinationPicker),
    stateProps._sortSetting,
    (T.FS.pathIsNonTeamTLFList(path) && stateProps._username) || ''
  )
}

const getNormalRowItemsFromStateProps = (
  stateProps: StateProps,
  path: T.FS.Path,
  editSessions: ReadonlyMap<T.FS.EditID, BrowserEditSession>,
  inDestinationPicker?: boolean
): Array<RowTypes.NamedRowItem> => {
  const level = T.FS.getPathLevel(path)
  switch (level) {
    case 0:
    case 1:
      return [] // should never happen
    case 2:
      return getTlfItemsFromStateProps(stateProps, path, inDestinationPicker)
    default:
      return getInTlfItemsFromStateProps(stateProps, path, editSessions)
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
  const {_legacyEdits, _pathItems, _sortSetting, _tlfs, commitEdit, discardEdit, setEditName} = useFSState(
    C.useShallow(s => {
      const _legacyEdits = s.edits
      const _pathItems = s.pathItems
      const _sortSetting = FS.getPathUserSetting(s.pathUserSettings, o.path).sort
      const _tlfs = s.tlfs
      const {commitEdit, discardEdit, setEditName} = s.dispatch
      return {_legacyEdits, _pathItems, _sortSetting, _tlfs, commitEdit, discardEdit, setEditName}
    })
  )
  const _username = useCurrentUserState(s => s.username)
  const browserEdits = useFsBrowserEdits()
  const legacyEditWaiting = C.Waiting.useAnyWaiting([C.waitingKeyFSCommitEdit])
  const editSessions = new Map<T.FS.EditID, BrowserEditSession>()
  _legacyEdits.forEach((edit, editID) => {
    editSessions.set(editID, {
      commitEdit: () => commitEdit(editID),
      discardEdit: () => discardEdit(editID),
      edit,
      editID,
      isSubmitting: legacyEditWaiting,
      setEditName: (name: string) => setEditName(editID, name),
    })
  })
  browserEdits?.edits.forEach((editSession, editID) => {
    editSessions.set(editID, editSession)
  })

  const s = {
    _pathItems,
    _sortSetting,
    _tlfs,
    _username,
  }
  const inDestinationPicker = !!o.destinationPickerSource

  const normalRowItems = getNormalRowItemsFromStateProps(s, o.path, editSessions, inDestinationPicker)
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
