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
  _loadFolderList: (path: Types.Path) => dispatch(FsGen.createFolderListLoad({path})),
  _sortSettingChangeFactory: (path: Types.Path) => (setting: Types.SortSetting) =>
    dispatch(FsGen.createSortSetting({path: path, sortSetting: Constants.makeSortSetting(setting)})),
})

const _getToggles = (sortSetting: Types.SortSetting, sortSettingChange: _sortSettingSetter) => {
  const nextBy = sortSetting.sortBy === 'name' ? 'time' : sortSetting.sortBy === 'time' ? 'size' : 'name'
  const nextOrder = sortSetting.sortOrder === 'asc' ? 'desc' : 'asc'
  return {
    toggleSortBy: () =>
      sortSettingChange({
        sortBy: nextBy,
        sortOrder: sortSetting.sortOrder,
      }),
    toggleSortOrder: () =>
      sortSettingChange({
        sortBy: sortSetting.sortBy,
        sortOrder: nextOrder,
      }),
  }
}

const mergeProps = (
  {path, itemNames, progress, sortSetting, pathItems, username}: StateProps,
  {_sortSettingChangeFactory, ...dispatchProps}: DispatchProps,
  ownProps
) => ({
  items: Constants.sortPathItems(
    itemNames
      .map(name => Types.pathConcat(path, name))
      .map(p => pathItems.get(p, Constants.makeUnknownPathItem())), // provide an unknown default to make flow happy
    sortSetting,
    Types.pathIsNonTeamTLFList(path) ? username : undefined
  )
    .map(({name}) => Types.pathConcat(path, name))
    .toArray(),
  progress,
  path,
  sortSetting,
  ..._getToggles(sortSetting, _sortSettingChangeFactory(path)),
  /* TODO: enable these once we need them:
  name: Types.getPathName(stateProps.path),
  visibility: Types.getPathVisibility(stateProps.path),
  */
  ...dispatchProps,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentWillMount() {
      this.props._loadFolderList(this.props.path)
    },
  }),
  setDisplayName('Files')
)(Files)
