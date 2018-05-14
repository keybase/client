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
import SecurityPrefsPromptingHoc from './common/security-prefs-prompting-hoc'

const mapStateToProps = (state: TypedState, {path}) => {
  const itemDetail = state.fs.pathItems.get(path)
  const itemChildren =
    itemDetail && itemDetail.type === 'folder' ? itemDetail.get('children', I.Set()) : I.Set()
  const itemFavoriteChildren =
    itemDetail && itemDetail.type === 'folder' ? itemDetail.get('favoriteChildren', I.Set()) : I.Set()
  return {
    _itemChildren: itemChildren,
    _itemFavoriteChildren: itemFavoriteChildren,
    _username: state.config.username || undefined,
    _pathItems: state.fs.pathItems,
    _sortSetting: state.fs.pathUserSettings.get(path, Constants.makePathUserSetting()).get('sort'),
    path,
    progress: itemDetail ? itemDetail.progress : 'pending',
  }
}

const mergeProps = (stateProps, dispatchProps, {routePath}) => {
  const itemNames = stateProps._itemChildren.union(stateProps._itemFavoriteChildren)
  const pathItems = itemNames.map(name => {
    return (
      stateProps._pathItems.get(Types.pathConcat(stateProps.path, name)) ||
      Constants.makeUnknownPathItem({name})
    )
  })
  const filteredPathItems = pathItems.filter(item => !(item.tlfMeta && item.tlfMeta.isIgnored)).toList()
  const username = Types.pathIsNonTeamTLFList(stateProps.path) ? stateProps._username : undefined
  const items = Constants.sortPathItems(filteredPathItems, stateProps._sortSetting, username)
    .map(({name}) => Types.pathConcat(stateProps.path, name))
    .toArray()
  return {
    routePath,
    items,
    progress: stateProps.progress,
    path: stateProps.path,
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
      this.props.path !== prevProps.path && this.props.loadFolderList(this.props.path)
      Types.getPathLevel(this.props.path) === 2 && this.props.loadFavorites()
    },
  }),
  setDisplayName('FilesLoadingHoc')
)(ConnectedFiles)

export default SecurityPrefsPromptingHoc(FilesLoadingHoc)
