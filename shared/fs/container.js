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
  return {
    _itemNames: itemDetail && itemDetail.type === 'folder' ? itemDetail.get('children', I.List()) : I.List(),
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
  const pathItems = stateProps._itemNames.map(name =>
    stateProps._pathItems.get(Types.pathConcat(stateProps.path, name), Constants.makeUnknownPathItem())
  )
  const username = Types.pathIsNonTeamTLFList(stateProps.path) ? stateProps._username : undefined
  const items = Constants.sortPathItems(pathItems, stateProps._sortSetting, username)
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
    componentWillMount() {
      this.props.loadFolderList(this.props.path)
      this.props.loadFavorites()
    },
    componentWillReceiveProps(nextProps) {
      // This check is needed since otherwise when e.g. user clicks a popup
      // menu, we'd end up triggerring loadFolderList too even though we didn't
      // navigate to a different path.
      if (this.props.path !== nextProps.path) {
        this.props.loadFolderList(nextProps.path)
      }
    },
  }),
  setDisplayName('FilesLoadingHoc')
)(ConnectedFiles)

export default FilesLoadingHoc
