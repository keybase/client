// @flow
import * as I from 'immutable'
import {compose, namedConnect} from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {
  sortRowItems,
  type SortableStillRowItem,
  type SortableEditingRowItem,
  type SortableUploadingRowItem,
  type SortableRowItem,
} from '../utils/sort'
import FilesLoadingHoc from './files-loading-hoc'
import Rows from './rows'

type OwnProps = {
  path: Types.Path, // path to the parent folder containering the rows
  sortSetting: Types.SortSetting,
  routePath: I.List<string>,
  destinationPickerIndex?: number,
}

const getEditingRows = (
  edits: I.Map<Types.EditID, Types.Edit>,
  parentPath: Types.Path
): Array<SortableEditingRowItem> =>
  edits
    .filter(edit => edit.parentPath === parentPath)
    .toArray()
    .map(([editID, edit]) => ({
      rowType: 'editing',
      editID,
      name: edit.name,
      key: `edit:${Types.editIDToString(editID)}`,
      // fields for sortable
      editType: edit.type,
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
        rowType: 'still',
        path,
        name: item.name,
        key: `still:${name}`,
        // fields for sortable
        type: item.type,
        lastModifiedTimestamp: item.lastModifiedTimestamp,
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
      rowType: 'uploading',
      name,
      path,
      key: `uploading:${name}`,
      // field for sortable
      type,
    }: SortableUploadingRowItem)
  })

const getPlaceholderRows = type => [
  {rowType: 'placeholder', name: '1', type, key: 'placeholder:1'},
  {rowType: 'placeholder', name: '2', type, key: 'placeholder:2'},
  {rowType: 'placeholder', name: '3', type, key: 'placeholder:3'},
]

const getInTlfItemsFromStateProps = (stateProps, path: Types.Path, sortSetting) => {
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
    sortSetting,
    undefined
  )
}

const getRootRows = (stateProps, sortSetting) =>
  sortRowItems(
    [
      {rowType: 'tlf-type', name: 'private', type: 'folder', key: 'tlfType:private'},
      {rowType: 'tlf-type', name: 'public', type: 'folder', key: 'tlfType:public'},
      {rowType: 'tlf-type', name: 'team', type: 'folder', key: 'tlfType:team'},
    ],
    sortSetting,
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
              rowType: 'tlf',
              tlfType,
              name,
              key: `tlf:${name}`,
              type: 'folder',
            },
          ],
    ([]: Array<SortableRowItem>)
  )

const getTlfItemsFromStateProps = (stateProps, path, sortSetting) => {
  if (stateProps._tlfs.private.count() === 0) {
    // /keybase/private/<me> is always favorited. If it's not there it must be
    // unintialized.
    return getPlaceholderRows('folder')
  }

  const {tlfList, tlfType} = Constants.getTlfListAndTypeFromPath(stateProps._tlfs, path)
  return sortRowItems(
    getTlfRowsFromTlfs(tlfList, tlfType),
    sortSetting,
    (Types.pathIsNonTeamTLFList(path) && stateProps._username) || undefined
  )
}

const getItemsFromStateProps = (stateProps, path, sortSetting) => {
  const level = Types.getPathLevel(path)
  switch (level) {
    case 0:
      return [] // should never happen
    case 1:
      return getRootRows(stateProps, sortSetting)
    case 2:
      return getTlfItemsFromStateProps(stateProps, path, sortSetting)
    default:
      return getInTlfItemsFromStateProps(stateProps, path, sortSetting)
  }
}

const mapStateToProps = state => ({
  _edits: state.fs.edits,
  _pathItems: state.fs.pathItems,
  _tlfs: state.fs.tlfs,
  _uploads: state.fs.uploads,
  _username: state.config.username,
})

const mapDispatchToProps = dispatch => ({})

const mergeProps = (s, d, o: OwnProps) => ({
  items: getItemsFromStateProps(s, o.path, o.sortSetting),
  routePath: o.routePath,
  destinationPickerIndex: o.destinationPickerIndex,
})

export default compose(
  FilesLoadingHoc,
  // $FlowIssue @jzila/@songgao lots of exposed flow issues here
  namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'ConnectedRows')
)(Rows)
