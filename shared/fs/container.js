// @flow
import * as I from 'immutable'
import {compose, connect, lifecycle, setDisplayName, type Dispatch, type TypedState} from '../util/container'
import Files from '.'
import * as FsGen from '../actions/fs-gen'
import * as Types from '../constants/types/fs'
import * as Constants from '../constants/fs'

type OwnProps = {
  routeProps: I.Map<'path', string>,
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

const mapStateToProps = (state: TypedState, {routeProps}: OwnProps) => {
  const path = Types.stringToPath(routeProps.get('path', Constants.defaultPath))
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

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps) => ({
  items: Constants.sortPathItems(
    stateProps._itemNames.map(name => Types.pathConcat(stateProps.path, name)).map(
      p => stateProps._pathItems.get(p, Constants.makeUnknownPathItem()) // provide an unknown default to make flow happy
    ),
    stateProps._sortSetting,
    Types.pathIsNonTeamTLFList(stateProps.path) ? stateProps._username : undefined
  )
    .map(({name}) => Types.pathConcat(stateProps.path, name))
    .toArray(),
  progress: stateProps.progress,
  path: stateProps.path,

  loadFolderList: dispatchProps.loadFolderList,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentWillMount() {
      this.props.loadFolderList(this.props.path)
    },
  }),
  setDisplayName('Files')
)(Files)
