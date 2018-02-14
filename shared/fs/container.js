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
  items: I.List<Types.PathItem>,
  progress: Types.ProgressType,
  sortSetting: Types.SortSetting,
}

type DispatchProps = {
  _sortSettingChangeFactory: (path: Types.Path) => (setting: Types._SortSetting) => void,
}

const mapStateToProps = (state: TypedState, {routeProps}: OwnProps) => {
  const path = Types.stringToPath(routeProps.get('path', Constants.defaultPath))
  const sortSetting = state.fs.pathUserSettings.get(path, Constants.makePathUserSetting()).get('sort')
  const itemDetail = state.fs.pathItems.get(path)
  const itemNames =
    itemDetail && itemDetail.type === 'folder' ? itemDetail.get('children', I.List()) : I.List()
  const items: I.List<Types.PathItem> = itemNames
    .map(name => Types.pathConcat(path, name))
    .map(p => state.fs.pathItems.get(p, Constants.makeUnknownPathItem())) // provide an unknown default to make flow happy
  const progress: Types.ProgressType = itemDetail ? itemDetail.progress : 'pending'
  return {items, path, progress, sortSetting}
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _loadFolderList: (path: Types.Path) => dispatch(FsGen.createFolderListLoad({path})),
  _sortSettingChangeFactory: (path: Types.Path) => (setting: Types.SortSetting) =>
    dispatch(FsGen.createSortSetting({path: path, sortSetting: Constants.makeSortSetting(setting)})),
})

const mergeProps = (
  {path, items, progress, sortSetting}: StateProps,
  {_sortSettingChangeFactory, ...dispatchProps}: DispatchProps,
  ownProps
) => ({
  items: Constants.sortPathItems(items, sortSetting)
    .map(({name}) => Types.pathConcat(path, name))
    .toArray(),
  progress,
  path,
  sortSetting,
  onSortSettingChange: _sortSettingChangeFactory(path),
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
