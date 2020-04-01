import {namedConnect} from '../../../util/container'
import * as Types from '../../../constants/types/fs'
import * as RowTypes from './types'
import * as Constants from '../../../constants/fs'
import {isMobile} from '../../../constants/platform'
import {sortRowItems, SortableRowItem} from './sort'
import Rows, {Props} from './rows'
import {asRows as topBarAsRow} from '../../top-bar'
import {memoize} from '../../../util/memoize'

type OwnProps = {
  path: Types.Path // path to the parent folder containering the rows,
  destinationPickerIndex?: number
  headerRows?: Array<RowTypes.HeaderRowItem> | null
}

const getStillRows = memoize(
  (
    pathItems: Map<Types.Path, Types.PathItem>,
    parentPath: Types.Path,
    names: Set<string>
  ): Array<RowTypes.StillRowItem> =>
    [...names].reduce<Array<RowTypes.StillRowItem>>((items, name) => {
      const item = Constants.getPathItem(pathItems, Types.pathConcat(parentPath, name))
      const path = Types.pathConcat(parentPath, item.name)
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
)

const _getPlaceholderRows = (type): Array<RowTypes.PlaceholderRowItem> => [
  {key: 'placeholder:1', name: '1', rowType: RowTypes.RowType.Placeholder, type},
  {key: 'placeholder:2', name: '2', rowType: RowTypes.RowType.Placeholder, type},
  {key: 'placeholder:3', name: '3', rowType: RowTypes.RowType.Placeholder, type},
]
const filePlaceholderRows = _getPlaceholderRows(Types.PathType.File)
const folderPlaceholderRows = _getPlaceholderRows(Types.PathType.Folder)

const _makeInTlfRows = memoize(
  (parentPath: Types.Path, edits: Map<Types.EditID, Types.Edit>, stillRows: Array<RowTypes.StillRowItem>) => {
    const relevantEdits = [...edits].filter(([_, edit]) => edit.parentPath === parentPath)
    const newFolderRows: Array<SortableRowItem> = relevantEdits
      .filter(([_, edit]) => edit.type === Types.EditType.NewFolder)
      .map(([editID, edit]) => ({
        editID,
        editType: edit.type,
        key: `edit:${Types.editIDToString(editID)}`,
        name: edit.name,
        // fields for sortable
        rowType: RowTypes.RowType.NewFolder,
        type: Types.PathType.Folder,
      }))
    const renameEdits = new Map(
      relevantEdits
        .filter(([_, edit]) => edit.type === Types.EditType.Rename)
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
)

const getInTlfItemsFromStateProps = (stateProps, path: Types.Path): Array<RowTypes.NamedRowItem> => {
  const _pathItem = Constants.getPathItem(stateProps._pathItems, path)
  if (_pathItem.type !== Types.PathType.Folder) {
    return filePlaceholderRows
  }

  if (_pathItem.progress === Types.ProgressType.Pending) {
    return filePlaceholderRows
  }

  const stillRows = getStillRows(stateProps._pathItems, path, _pathItem.children)

  return sortRowItems(_makeInTlfRows(path, stateProps._edits, stillRows), stateProps._sortSetting, '')
}

const getTlfRowsFromTlfs = memoize(
  (
    tlfs: Map<string, Types.Tlf>,
    tlfType: Types.TlfType,
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
        type: Types.PathType.Folder,
      }))
)

const getTlfItemsFromStateProps = (
  stateProps,
  path,
  destinationPickerIndex
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
    (Types.pathIsNonTeamTLFList(path) && stateProps._username) || ''
  )
}

const getNormalRowItemsFromStateProps = (
  stateProps,
  path,
  destinationPickerIndex
): Array<RowTypes.NamedRowItem> => {
  const level = Types.getPathLevel(path)
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
const filterRowItems = (rows, filter) =>
  filter
    ? rows.filter(
        row => !filterable.has(row.rowType) || row.name.toLowerCase().includes(filter.toLowerCase())
      )
    : rows

export default namedConnect(
  (state, {path}: OwnProps) => ({
    _edits: state.fs.edits,
    _filter: state.fs.folderViewFilter,
    _pathItems: state.fs.pathItems,
    _sortSetting: Constants.getPathUserSetting(state.fs.pathUserSettings, path).sort,
    _tlfs: state.fs.tlfs,
    _username: state.config.username,
  }),
  () => ({}),
  (s, _, o: OwnProps) => {
    const normalRowItems = getNormalRowItemsFromStateProps(s, o.path, o.destinationPickerIndex)
    const filteredRowItems = filterRowItems(normalRowItems, s._filter)
    return {
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
        (!isMobile && typeof o.destinationPickerIndex === 'number'
          ? [
              {key: 'empty:0', rowType: RowTypes.RowType.Empty},
              {key: 'empty:1', rowType: RowTypes.RowType.Empty},
            ]
          : []),
      ],
      path: o.path,
    }
  },
  'ConnectedRows'
)(Rows)
