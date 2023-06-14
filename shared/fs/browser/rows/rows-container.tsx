import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/fs'
import * as RowTypes from './types'
import * as Constants from '../../../constants/fs'
import * as ConfigConstants from '../../../constants/config'
import {isMobile} from '../../../constants/platform'
import {sortRowItems, type SortableRowItem} from './sort'
import Rows, {type Props} from './rows'
import {asRows as topBarAsRow} from '../../top-bar'
import {memoize} from '../../../util/memoize'

type OwnProps = {
  path: Types.Path // path to the parent folder containering the rows,
  destinationPickerIndex?: number
  headerRows?: Array<RowTypes.HeaderRowItem>
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

const _getPlaceholderRows = (
  type: Types.PathType.File | Types.PathType.Folder
): Array<RowTypes.PlaceholderRowItem> => [
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

const getInTlfItemsFromStateProps = (
  stateProps: StateProps,
  path: Types.Path
): Array<RowTypes.NamedRowItem> => {
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

type StateProps = {
  _edits: Types.Edits
  _filter: string | undefined
  _pathItems: Types.PathItems
  _sortSetting: Types.SortSetting
  _tlfs: Types.Tlfs
  _username: string
}

const getTlfItemsFromStateProps = (
  stateProps: StateProps,
  path: Types.Path,
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
    (Types.pathIsNonTeamTLFList(path) && stateProps._username) || ''
  )
}

const getNormalRowItemsFromStateProps = (
  stateProps: StateProps,
  path: Types.Path,
  destinationPickerIndex?: number
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
const filterRowItems = (rows: Array<RowTypes.NamedRowItem>, filter?: string) =>
  filter
    ? rows.filter(
        row => !filterable.has(row.rowType) || row.name.toLowerCase().includes(filter.toLowerCase())
      )
    : rows

export default (o: OwnProps) => {
  const _edits = Container.useSelector(state => state.fs.edits)
  const _filter = Container.useSelector(state => state.fs.folderViewFilter)
  const _pathItems = Container.useSelector(state => state.fs.pathItems)
  const _sortSetting = Container.useSelector(
    state => Constants.getPathUserSetting(state.fs.pathUserSettings, o.path).sort
  )
  const _tlfs = Container.useSelector(state => state.fs.tlfs)
  const _username = ConfigConstants.useCurrentUserState(s => s.username)

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
      (!isMobile && typeof o.destinationPickerIndex === 'number'
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
