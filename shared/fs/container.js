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

type OwnProps = {
  path: Types.Path,
}

type StateProps = {
  _itemNames: I.List<string>,
  _username?: string,
  _pathItems: I.Map<Types.Path, Types.PathItem>,
  _sortSetting: Types.SortSetting,

  path: Types.Path,
  progress: Types.ProgressType,
}

type DispatchProps = {
  loadFolderList: (path: Types.Path) => void,
}

const mapStateToProps = (state: TypedState, {path}: OwnProps) => {
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
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps) => {
  const pathItems = stateProps._itemNames
    // TODO: hook up store when we have this in settings.
    .filter(name => !name.startsWith('._') && name !== '.DS_Store' && name !== '.darwin')
    .map(name =>
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
  }
}

const ConnectedFiles = compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('Files')
)(Files)

const FilesLoadingHoc = compose(
  connect(undefined, (dispatch: Dispatch) => ({
    loadFolderList: (path: Types.Path) => dispatch(FsGen.createFolderListLoad({path})),
  })),
  mapProps(({routeProps, loadFolderList}) => ({
    path: routeProps.get('path', Constants.defaultPath),
    loadFolderList,
  })),
  lifecycle({
    componentWillMount() {
      this.props.loadFolderList(this.props.path)
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
