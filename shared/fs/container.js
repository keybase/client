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
  path: Types.Path,
  itemNames: I.List<string>,
  progress: Types.ProgressType,
  sortSetting: Types.SortSetting,
  username?: string,
  pathItems: I.Map<Types.Path, Types.PathItem>,
}

type _sortSettingSetter = (setting: Types._SortSetting) => void
type DispatchProps = {
  loadFolderList: (path: Types.Path) => void,
  _sortSettingChangeFactory: (path: Types.Path) => _sortSettingSetter,
}

const mapStateToProps = (state: TypedState, {routeProps}: OwnProps) => {
  const path = Types.stringToPath(routeProps.get('path', Constants.defaultPath))
  const sortSetting = state.fs.pathUserSettings.get(path, Constants.makePathUserSetting()).get('sort')
  const itemDetail = state.fs.pathItems.get(path)
  const itemNames =
    itemDetail && itemDetail.type === 'folder' ? itemDetail.get('children', I.List()) : I.List()
  const progress: Types.ProgressType = itemDetail ? itemDetail.progress : 'pending'
  const username = state.config.username || undefined
  const pathItems = state.fs.pathItems
  return {itemNames, path, progress, sortSetting, username, pathItems}
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  loadFolderList: (path: Types.Path) => dispatch(FsGen.createFolderListLoad({path})),
  _sortSettingChangeFactory: (path: Types.Path) => (setting: Types.SortSetting) =>
    dispatch(FsGen.createSortSetting({path: path, sortSetting: Constants.makeSortSetting(setting)})),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps) => {
  const setSortSetting = dispatchProps._sortSettingChangeFactory(stateProps.path)
  return {
    items: Constants.sortPathItems(
      stateProps.itemNames.map(name => Types.pathConcat(stateProps.path, name)).map(
        p => stateProps.pathItems.get(p, Constants.makeUnknownPathItem()) // provide an unknown default to make flow happy
      ),
      stateProps.sortSetting,
      Types.pathIsNonTeamTLFList(stateProps.path) ? stateProps.username : undefined
    )
      .map(({name}) => Types.pathConcat(stateProps.path, name))
      .toArray(),
    progress: stateProps.progress,
    path: stateProps.path,
    sortSetting: stateProps.sortSetting,

    setSortByNameAsc: () => setSortSetting({sortBy: 'name', sortOrder: 'asc'}),
    setSortByNameDesc: () => setSortSetting({sortBy: 'name', sortOrder: 'desc'}),
    setSortByTimeAsc: () => setSortSetting({sortBy: 'time', sortOrder: 'asc'}),
    setSortByTimeDesc: () => setSortSetting({sortBy: 'time', sortOrder: 'desc'}),

    loadFolderList: dispatchProps.loadFolderList,
    /* TODO: enable these once we need them:
    name: Types.getPathName(stateProps.path),
    visibility: Types.getPathVisibility(stateProps.path),
    */
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentWillMount() {
      this.props.loadFolderList(this.props.path)
    },
  }),
  setDisplayName('Files')
)(Files)
