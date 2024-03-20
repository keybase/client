import * as React from 'react'
import * as C from '@/constants'
import * as Constants from '@/constants/fs'
import * as T from '@/constants/types'
import * as RowTypes from './types'
import {sortRowItems, type SortableRowItem} from './sort'
import Rows, {type Props} from './rows'
import {asRows as topBarAsRow} from '../../top-bar'

type OwnProps = {
  path: T.FS.Path // path to the parent folder containering the rows,
  destinationPickerIndex?: number
  headerRows?: Array<RowTypes.HeaderRowItem>
}

const getStillRows = (
  pathItems: T.Immutable<Map<T.FS.Path, T.FS.PathItem>>,
  parentPath: T.Immutable<T.FS.Path>,
  names: ReadonlySet<string>
): Array<RowTypes.StillRowItem> =>
  [...names].reduce<Array<RowTypes.StillRowItem>>((items, name) => {
    const item = C.FS.getPathItem(pathItems, T.FS.pathConcat(parentPath, name))
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
  edits: T.Immutable<Map<T.FS.EditID, T.FS.Edit>>,
  stillRows: T.Immutable<Array<RowTypes.StillRowItem>>
) => {
  const relevantEdits = [...edits].filter(([_, edit]) => edit.parentPath === parentPath)
  const newFolderRows: Array<SortableRowItem> = relevantEdits
    .filter(([_, edit]) => edit.type === T.FS.EditType.NewFolder)
    .map(([editID, edit]) => ({
      editID,
      editType: edit.type,
      key: `edit:${T.FS.editIDToString(editID)}`,
      name: edit.name,
      // fields for sortable
      rowType: RowTypes.RowType.NewFolder,
      type: T.FS.PathType.Folder,
    }))
  const renameEdits = new Map(
    relevantEdits
      .filter(([_, edit]) => edit.type === T.FS.EditType.Rename)
      .map(([editID, edit]) => [edit.originalName, editID])
  )
  return newFolderRows.concat(
    stillRows.map(row =>
      renameEdits.has(row.name)
        ? {
            ...row,
            editID: renameEdits.get(row.name),
          }
        : row
    )
  )
}

const getInTlfItemsFromStateProps = (
  stateProps: StateProps,
  path: T.FS.Path
): Array<RowTypes.NamedRowItem> => {
  const _pathItem = C.FS.getPathItem(stateProps._pathItems, path)
  if (_pathItem.type !== T.FS.PathType.Folder) {
    return filePlaceholderRows
  }

  if (_pathItem.progress === T.FS.ProgressType.Pending) {
    return filePlaceholderRows
  }

  const stillRows = getStillRows(stateProps._pathItems, path, _pathItem.children)
  return sortRowItems(_makeInTlfRows(path, stateProps._edits, stillRows), stateProps._sortSetting, '')
}

const getTlfRowsFromTlfs = (
  tlfs: T.Immutable<Map<string, T.FS.Tlf>>,
  tlfType: T.Immutable<T.FS.TlfType>,
  username: string,
  destinationPickerIndex?: number
): Array<SortableRowItem> =>
  [...tlfs]
    .filter(([_, {isIgnored}]) => !isIgnored)
    .map(([name, {isNew, tlfMtime}]) => ({
      disabled: Constants.hideOrDisableInDestinationPicker(tlfType, name, username, destinationPickerIndex),
      isNew,
      key: `tlf:${name}`,
      name,
      rowType: RowTypes.RowType.Tlf,
      tlfMtime,
      tlfType,
      type: T.FS.PathType.Folder,
    }))

type StateProps = {
  _edits: T.FS.Edits
  _filter: string | undefined
  _pathItems: T.FS.PathItems
  _sortSetting: T.FS.SortSetting
  _tlfs: T.FS.Tlfs
  _username: string
}

const getTlfItemsFromStateProps = (
  stateProps: StateProps,
  path: T.FS.Path,
  destinationPickerIndex?: number
): Array<RowTypes.NamedRowItem> => {
  if (stateProps._tlfs.private.size === 0) {
    // /keybase/private/<me> is always favorited. If it's not there it must be
    // unintialized.
    return folderPlaceholderRows
  }

  const {tlfList, tlfType} = Constants.getTlfListAndTypeFromPath(stateProps._tlfs, path)

  return sortRowItems(
    getTlfRowsFromTlfs(tlfList, tlfType, stateProps._username, destinationPickerIndex),
    stateProps._sortSetting,
    (T.FS.pathIsNonTeamTLFList(path) && stateProps._username) || ''
  )
}

const getNormalRowItemsFromStateProps = (
  stateProps: StateProps,
  path: T.FS.Path,
  destinationPickerIndex?: number
): Array<RowTypes.NamedRowItem> => {
  const level = T.FS.getPathLevel(path)
  switch (level) {
    case 0:
    case 1:
      return [] // should never happen
    case 2:
      return getTlfItemsFromStateProps(stateProps, path, destinationPickerIndex)
    default:
      return getInTlfItemsFromStateProps(stateProps, path)
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
  const _edits = C.useFSState(s => s.edits)
  const _filter = C.useFSState(s => s.folderViewFilter)
  const _pathItems = C.useFSState(s => s.pathItems)
  const _sortSetting = C.useFSState(s => Constants.getPathUserSetting(s.pathUserSettings, o.path).sort)
  const _tlfs = C.useFSState(s => s.tlfs)
  const _username = C.useCurrentUserState(s => s.username)

  const s = {
    _edits,
    _filter,
    _pathItems,
    _sortSetting,
    _tlfs,
    _username,
  }

  const normalRowItems = getNormalRowItemsFromStateProps(s, o.path, o.destinationPickerIndex)
  const filteredRowItems = filterRowItems(normalRowItems, _filter)
  const props = {
    destinationPickerIndex: o.destinationPickerIndex,
    emptyMode: !normalRowItems.length
      ? 'empty'
      : !filteredRowItems.length
        ? 'not-empty-but-no-match'
        : ('not-empty' as Props['emptyMode']),
    items: [
      ...(o.headerRows || []),
      // don't show top bar in destinationPicker.
      ...(typeof o.destinationPickerIndex === 'number' ? [] : topBarAsRow(o.path)),
      ...filteredRowItems,
      ...// If we are in the destination picker, inject two empty rows so when
      // user scrolls to the bottom nothing is blocked by the
      // semi-transparent footer.
      //
      // TODO: add `footerRows` and inject these from destination-picker, so that
      // Rows componenet don't need to worry about whether it's in
      // destinationPicker mode or not.
      (!C.isMobile && typeof o.destinationPickerIndex === 'number'
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
