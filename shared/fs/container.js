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

const mapDispatchToProps = (dispatch: Dispatch) => ({
  loadFolderList: (path: Types.Path) => dispatch(FsGen.createFolderListLoad({path})),
  loadFavorites: () => dispatch(FsGen.createFavoritesLoad()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
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
    items,
    progress: stateProps.progress,
    path: stateProps.path,

    loadFolderList: dispatchProps.loadFolderList,
    loadFavorites: dispatchProps.loadFavorites,
  }
}

const ConnectedFiles = compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('Files')
)(Files)

const FilesLoadingHoc = compose(
  connect(undefined, (dispatch: Dispatch) => ({
    loadFolderList: (path: Types.Path) => dispatch(FsGen.createFolderListLoad({path})),
    loadFavorites: () => dispatch(FsGen.createFavoritesLoad()),
  })),
  mapProps(({routeProps, loadFolderList, loadFavorites}) => ({
    path: routeProps.get('path', Constants.defaultPath),
    loadFolderList,
    loadFavorites,
  })),
  lifecycle({
    componentDidMount() {
      this.props.loadFolderList(this.props.path)
      this.props.loadFavorites()
    },
    componentDidUpdate() {
      this.props.loadFolderList(this.props.path)
    },
  }),
  setDisplayName('FilesLoadingHoc')
)(ConnectedFiles)

export default FilesLoadingHoc
