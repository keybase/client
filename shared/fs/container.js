// @flow
import * as I from 'immutable'
import {
  compose,
  connect,
  lifecycle,
  mapProps,
  setDisplayName,
  type Dispatch,
  type TypedState,
} from '../util/container'
import Files from '.'
import * as FsGen from '../actions/fs-gen'
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

const mapStateToProps = (state: TypedState, {path}) => {
  const itemDetail = state.fs.pathItems.get(path)
  const itemChildren =
    itemDetail && itemDetail.type === 'folder' ? itemDetail.get('children', I.Set()) : I.Set()
  const itemFavoriteChildren =
    itemDetail && itemDetail.type === 'folder' ? itemDetail.get('favoriteChildren', I.Set()) : I.Set()
  const _username = state.config.username || undefined
  const resetParticipants =
    itemDetail &&
    itemDetail.type === 'folder' &&
    !!itemDetail.tlfMeta &&
    itemDetail.tlfMeta.resetParticipants.length > 0
      ? itemDetail.tlfMeta.resetParticipants.map(i => i.username)
      : []
  const isUserReset = resetParticipants.includes(_username)
  const _transfers = state.fs.transfers
  return {
    _itemChildren: itemChildren,
    _itemFavoriteChildren: itemFavoriteChildren,
    _pathItems: state.fs.pathItems,
    _edits: state.fs.edits,
    _sortSetting: state.fs.pathUserSettings.get(path, Constants.makePathUserSetting()).get('sort'),
    _username,
    isUserReset,
    resetParticipants,
    _transfers,
    path,
    progress: itemDetail ? itemDetail.progress : 'pending',
  }
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

      editType: edit.type,
      type: 'folder',
    }))

const getStillRows = (
  pathItems: I.Map<Types.Path, Types.PathItem>,
  parentPath: Types.Path,
  names: Array<string>
): Array<SortableStillRowItem> =>
  names
    .map(name => pathItems.get(Types.pathConcat(parentPath, name), Constants.makeUnknownPathItem({name})))
    .filter(item => !(item.tlfMeta && item.tlfMeta.isIgnored))
    .map(item => ({
      rowType: 'still',
      path: Types.pathConcat(parentPath, item.name),
      name: item.name,

      type: item.type,
      tlfMeta: item.tlfMeta,
      lastModifiedTimestamp: item.lastModifiedTimestamp,
    }))

const getUploadingRows = (
  transfers: I.Map<string, Types.Transfer>,
  parentPath: Types.Path
): Array<SortableUploadingRowItem> =>
  transfers
    .filter(t => t.meta.type === 'upload' && Types.getPathParent(t.meta.path) === parentPath)
    .toArray()
    .map(([transferID, transfer]) => ({
      rowType: 'uploading',
      transferID,
      name: Types.getPathName(transfer.meta.path),

      type: transfer.meta.entryType,
      isDone: transfer.state.isDone,
    }))

// Assumption: folder list gets reloaded (and correcponding state updates in
// store) before a transfer is marked as done. In other words, a done upload
// must appear in the `children` of its parent PathItem, unless the item has
// been deleted.
//
// TODO: when we have renames, reconsile editing rows in here too.
const reconcileUploadingAndStillRows = (
  uploadings: Array<SortableUploadingRowItem>,
  stills: Array<SortableStillRowItem>
): Array<SortableRowItem> => {
  const pendingUploads: Array<SortableUploadingRowItem> = uploadings.filter(uploading => !uploading.isDone)
  const pendingUploadsNameSet = new Set(pendingUploads)
  const doneStills: Array<SortableStillRowItem> = stills.filter(
    still => !pendingUploadsNameSet.has(still.name)
  )
  return [...doneStills, ...pendingUploads]
}

const placeholderRows = [
  {rowType: 'placeholder', name: '1'},
  {rowType: 'placeholder', name: '2'},
  {rowType: 'placeholder', name: '3'},
]

const mergeProps = (stateProps, dispatchProps, {routePath}) => {
  if (stateProps.progress === 'pending') {
    return {
      routePath,
      items: placeholderRows,
      path: stateProps.path,
    }
  }

  const editingRows = getEditingRows(stateProps._edits, stateProps.path)
  const uploadingRows = getUploadingRows(stateProps._transfers, stateProps.path)
  const stillRows = getStillRows(
    stateProps._pathItems,
    stateProps.path,
    stateProps._itemChildren.union(stateProps._itemFavoriteChildren).toArray()
  )

  const items = sortRowItems(
    editingRows.concat(reconcileUploadingAndStillRows(uploadingRows, stillRows)),
    stateProps._sortSetting,
    Types.pathIsNonTeamTLFList(stateProps.path) ? stateProps._username : undefined
  )

  return {
    isUserReset: stateProps.isUserReset,
    resetParticipants: stateProps.resetParticipants,
    items,
    path: stateProps.path,
    progress: stateProps.progress,
    routePath,
  }
}

const ConnectedFiles = compose(connect(mapStateToProps, undefined, mergeProps), setDisplayName('Files'))(
  Files
)

const FilesLoadingHoc = compose(
  connect(undefined, (dispatch: Dispatch) => ({
    loadFolderList: (path: Types.Path) => dispatch(FsGen.createFolderListLoad({path})),
    loadFavorites: () => dispatch(FsGen.createFavoritesLoad()),
  })),
  mapProps(({routePath, routeProps, loadFolderList, loadFavorites}) => ({
    routePath,
    path: routeProps.get('path', Constants.defaultPath),
    loadFolderList,
    loadFavorites,
  })),
  lifecycle({
    componentDidMount() {
      this.props.loadFolderList(this.props.path)
      this.props.loadFavorites()
    },
    componentDidUpdate(prevProps) {
      // This gets called on route changes too, e.g. when user clicks the
      // action menu. So only load folder list when path changes.
      const pathLevel = Types.getPathLevel(this.props.path)
      this.props.path !== prevProps.path && this.props.loadFolderList(this.props.path)
      pathLevel === 2 && this.props.loadFavorites()
    },
  }),
  setDisplayName('FilesLoadingHoc')
)(ConnectedFiles)

export default SecurityPrefsPromptingHoc(FilesLoadingHoc)
