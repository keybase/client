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

const mapStateToProps = (state: TypedState, {path}) => {
  const itemDetail = state.fs.pathItems.get(path, Constants.makeUnknownPathItem())
  const itemChildren = itemDetail.type === 'folder' ? itemDetail.get('children', I.Set()) : I.Set()
  const itemFavoriteChildren =
    itemDetail.type === 'folder' ? itemDetail.get('favoriteChildren', I.Set()) : I.Set()
  const _username = state.config.username || undefined
  const resetParticipants =
    itemDetail.type === 'folder' && !!itemDetail.tlfMeta && itemDetail.tlfMeta.resetParticipants.length > 0
      ? itemDetail.tlfMeta.resetParticipants.map(i => i.username)
      : []
  const isUserReset = resetParticipants.includes(_username)
  const _downloads = state.fs.downloads
  console.log({msg: 'songgao', path, itemDetail, resetParticipants})
  return {
    _itemChildren: itemChildren,
    _itemFavoriteChildren: itemFavoriteChildren,
    _pathItems: state.fs.pathItems,
    _edits: state.fs.edits,
    _sortSetting: state.fs.pathUserSettings.get(path, Constants.makePathUserSetting()).get('sort'),
    _username,
    isUserReset,
    resetParticipants,
    _downloads,
    _uploads: state.fs.uploads,
    path,
    progress: itemDetail.progress,
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

// TODO: when we have renames, reconsile editing rows in here too.
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
      type,
    }: SortableUploadingRowItem)
  })

const placeholderRows = [
  {rowType: 'placeholder', name: '1'},
  {rowType: 'placeholder', name: '2'},
  {rowType: 'placeholder', name: '3'},
]

const getItemsFromStateProps = stateProps => {
  if (stateProps.progress === 'pending') {
    return placeholderRows
  }

  const editingRows = getEditingRows(stateProps._edits, stateProps.path)
  const stillRows = getStillRows(
    stateProps._pathItems,
    stateProps.path,
    stateProps._itemChildren.union(stateProps._itemFavoriteChildren).toArray()
  )

  return sortRowItems(
    editingRows.concat(amendStillRows(stillRows, stateProps._uploads)),
    stateProps._sortSetting,
    Types.pathIsNonTeamTLFList(stateProps.path) ? stateProps._username : undefined
  )
}

const mergeProps = (stateProps, dispatchProps, {routePath}) => ({
  isUserReset: stateProps.isUserReset,
  items: getItemsFromStateProps(stateProps),
  path: stateProps.path,
  progress: stateProps.progress,
  resetParticipants: stateProps.resetParticipants,
  routePath,
})

export default compose(
  SecurityPrefsPromptingHoc,
  FilesLoadingHoc,
  connect(mapStateToProps, undefined, mergeProps),
  setDisplayName('Files')
)(Files)
