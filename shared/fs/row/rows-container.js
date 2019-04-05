// @flow
import * as I from 'immutable'
import {namedConnect} from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as RowTypes from './types'
import * as Constants from '../../constants/fs'
import {isMobile} from '../../constants/platform'
import {
  sortRowItems,
  type SortableStillRowItem,
  type SortableEditingRowItem,
  type SortableUploadingRowItem,
  type SortableRowItem,
} from './sort'
import Rows from './rows'
import {asRows as topBarAsRow} from '../top-bar'

type OwnProps = {|
  path: Types.Path, // path to the parent folder containering the rows
  routePath: I.List<string>,
  destinationPickerIndex?: number,
  headerRows?: ?Array<RowTypes.RowItemWithKey>,
|}

const getEditingRows = (
  edits: I.Map<Types.EditID, Types.Edit>,
  parentPath: Types.Path
): Array<SortableEditingRowItem> =>
  edits
    .filter(edit => edit.parentPath === parentPath)
    .toArray()
    .map(([editID, edit]) => ({
      editID,
      editType: edit.type,
      key: `edit:${Types.editIDToString(editID)}`,
      name: edit.name,
      // fields for sortable
      rowType: 'editing',
      type: 'folder',
    }))

const getStillRows = (
  pathItems: I.Map<Types.Path, Types.PathItem>,
  parentPath: Types.Path,
  names: Array<string>
): Array<SortableStillRowItem> =>
  names.reduce((items, name) => {
    const item = pathItems.get(Types.pathConcat(parentPath, name), Constants.unknownPathItem)
    const path = Types.pathConcat(parentPath, item.name)
    return [
      ...items,
      {
        key: `still:${name}`,
        lastModifiedTimestamp: item.lastModifiedTimestamp,
        name: item.name,
        path,
        // fields for sortable
        rowType: 'still',
        type: item.type,
      },
    ]
  }, [])

// TODO: when we have renames, reconcile editing rows in here too.
const amendStillRows = (
  stills: Array<SortableStillRowItem>,
  uploads: Types.Uploads
): Array<SortableRowItem> =>
  stills.map(still => {
    const {name, type, path} = still
    if (type === 'folder') {
      // Don't show an upload row for folders.
      return still
    }
    if (!uploads.writingToJournal.has(path) && !uploads.syncingPaths.has(path)) {
      // The entry is absent from uploads. So just show a still row.
      return still
    }
    return ({
      key: `uploading:${name}`,
      name,
      path,
      rowType: 'uploading',
      // field for sortable
      type,
    }: SortableUploadingRowItem)
  })

const getPlaceholderRows = type => [
  {key: 'placeholder:1', name: '1', rowType: 'placeholder', type},
  {key: 'placeholder:2', name: '2', rowType: 'placeholder', type},
  {key: 'placeholder:3', name: '3', rowType: 'placeholder', type},
]

const getInTlfItemsFromStateProps = (stateProps, path: Types.Path) => {
  const _pathItem = stateProps._pathItems.get(path, Constants.unknownPathItem)
  if (_pathItem.type !== 'folder') {
    return getPlaceholderRows('file')
  }

  if (_pathItem.progress === 'pending') {
    return getPlaceholderRows('file')
  }

  const editingRows = getEditingRows(stateProps._edits, path)
  const stillRows = getStillRows(stateProps._pathItems, path, _pathItem.children.toArray())

  return sortRowItems(
    editingRows.concat(amendStillRows(stillRows, stateProps._uploads)),
    stateProps._sortSetting,
    undefined
  )
}

const getRootRows = stateProps =>
  sortRowItems(
    [
      {key: 'tlfType:private', name: 'private', rowType: 'tlf-type', type: 'folder'},
      {key: 'tlfType:public', name: 'public', rowType: 'tlf-type', type: 'folder'},
      {key: 'tlfType:team', name: 'team', rowType: 'tlf-type', type: 'folder'},
    ],
    stateProps._sortSetting,
    undefined
  )

const getTlfRowsFromTlfs = (tlfs: I.Map<string, Types.Tlf>, tlfType: Types.TlfType): Array<SortableRowItem> =>
  tlfs.reduce(
    (rows, {isIgnored, isNew}, name) =>
      isIgnored
        ? rows
        : [
            ...rows,
            {
              isNew,
              key: `tlf:${name}`,
              name,
              rowType: 'tlf',
              tlfType,
              type: 'folder',
            },
          ],
    ([]: Array<SortableRowItem>)
  )

const getTlfItemsFromStateProps = (stateProps, path) => {
  if (stateProps._tlfs.private.count() === 0) {
    // /keybase/private/<me> is always favorited. If it's not there it must be
    // unintialized.
    return getPlaceholderRows('folder')
  }

  const {tlfList, tlfType} = Constants.getTlfListAndTypeFromPath(stateProps._tlfs, path)
  return sortRowItems(
    getTlfRowsFromTlfs(tlfList, tlfType),
    stateProps._sortSetting,
    (Types.pathIsNonTeamTLFList(path) && stateProps._username) || undefined
  )
}

const getNormalRowItemsFromStateProps = (stateProps, path) => {
  const level = Types.getPathLevel(path)
  switch (level) {
    case 0:
      return [] // should never happen
    case 1:
      return getRootRows(stateProps)
    case 2:
      return getTlfItemsFromStateProps(stateProps, path)
    default:
      return getInTlfItemsFromStateProps(stateProps, path)
  }
}

const filterable = new Set(['tlf-type', 'tlf', 'still'])
const filterRowItems = (rows, filter) =>
  filter ? rows.filter(row => !filterable.has(row.rowType) || row.name.includes(filter)) : rows

const mapStateToProps = (state, {path}) => ({
  _edits: state.fs.edits,
  _filter: state.fs.folderViewFilter,
  _pathItems: state.fs.pathItems,
  _sortSetting: state.fs.pathUserSettings.get(path, Constants.defaultPathUserSetting).sort,
  _tlfs: state.fs.tlfs,
  _uploads: state.fs.uploads,
  _username: state.config.username,
})

const mapDispatchToProps = dispatch => ({})

const mergeProps = (s, d, o: OwnProps) => {
  const normalRowItems = filterRowItems(getNormalRowItemsFromStateProps(s, o.path), s._filter)
  return {
    destinationPickerIndex: o.destinationPickerIndex,
    isEmpty: !normalRowItems.length,
    // $FlowIssue
    items: [
      ...(o.headerRows || []),
      ...topBarAsRow(o.path),
      ...filterRowItems(normalRowItems),
      // If we are in the destination picker, inject two empty rows so when
      // user scrolls to the bottom nothing is blocked by the
      // semi-transparent footer.
      //
      // TODO: add `footerRows` and inject these from destination-picker, so that
      // Rows componenet don't need to worry about whether it's in
      // destinationPicker mode or not.
      ...(!isMobile && typeof o.destinationPickerIndex === 'number'
        ? [{key: 'empty:0', rowType: 'empty'}, {key: 'empty:1', rowType: 'empty'}]
        : []),
    ],
    path: o.path,
    routePath: o.routePath,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedRows'
)(Rows)
