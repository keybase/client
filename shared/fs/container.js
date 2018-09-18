// @flow
import * as I from 'immutable'
import {compose, connect, setDisplayName, type TypedState} from '../util/container'
import Files from '.'
import * as Types from '../constants/types/fs'
import * as Constants from '../constants/fs'
import {
  sortRowItems,
  type SortableStillRowItem,
  type SortableEditingRowItem,
  type SortableUploadingRowItem,
  type SortableRowItem,
} from './utils/sort'
import SecurityPrefsPromptingHoc from './common/security-prefs-prompting-hoc'
import FilesLoadingHoc from './files-loading-hoc'

const mapStateToProps = (state: TypedState, {path}) => ({
  _edits: state.fs.edits,
  _pathItems: state.fs.pathItems,
  _sortSetting: state.fs.pathUserSettings.get(path, Constants.makePathUserSetting()).get('sort'),
  _tlfs: state.fs.tlfs,
  _uploads: state.fs.uploads,
  _username: state.config.username,
})

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
    return [
      ...items,
      {
        rowType: 'still',
        path: Types.pathConcat(parentPath, item.name),
        name: item.name,
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
      // field for sortable
      type,
    }: SortableUploadingRowItem)
  })

const getPlaceholderRows = type => [
  {rowType: 'placeholder', name: '1', type},
  {rowType: 'placeholder', name: '2', type},
  {rowType: 'placeholder', name: '3', type},
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
      {rowType: 'tlf-type', name: 'private', type: 'folder'},
      {rowType: 'tlf-type', name: 'public', type: 'folder'},
      {rowType: 'tlf-type', name: 'team', type: 'folder'},
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
              rowType: 'tlf',
              tlfType,
              name,
              type: 'folder',
            },
          ],
    ([]: Array<SortableRowItem>)
  )

const getTlfItemsFromStateProps = (stateProps, path: Types.Path) => {
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

const getItemsFromStateProps = (stateProps, path: Types.Path) => {
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

const mergeProps = (stateProps, dispatchProps, {path, routePath}) => {
  const {tlfList} = Constants.getTlfListAndTypeFromPath(stateProps._tlfs, path)
  const elems = Types.getPathElements(path)
  const resetParticipants = tlfList
    .get(elems[2], Constants.makeTlf())
    .resetParticipants.map(i => i.username)
    .toArray()
  const isUserReset = !!stateProps._username && resetParticipants.includes(stateProps._username)
  const items = getItemsFromStateProps(stateProps, path)
  return {isUserReset, items, path, resetParticipants, routePath}
}

export default compose(
  SecurityPrefsPromptingHoc,
  FilesLoadingHoc,
  // $FlowIssue @jzila lots of exposed flow issues here
  connect(mapStateToProps, () => ({}), mergeProps),
  setDisplayName('Files')
)(Files)
