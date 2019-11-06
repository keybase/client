import * as Container from '../../util/container'
import Sort from './sort'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'

type OwnProps = {
  path: Types.Path
}

const mapStateToProps = (state: Container.TypedState, {path}: OwnProps) => ({
  _kbfsDaemonStatus: state.fs.kbfsDaemonStatus,
  _pathItem: Constants.getPathItem(state.fs.pathItems, path),
  _sortSetting: (state.fs.pathUserSettings.get(path) || Constants.getDefaultPathUserSetting(path))
    .sortSetting,
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch, {path}: OwnProps) => ({
  sortByNameAsc:
    path === Constants.defaultPath
      ? undefined
      : () => dispatch(FsGen.createSetSortSetting({path, sortSetting: Types.SortSetting.NameAsc})),
  sortByNameDesc:
    path === Constants.defaultPath
      ? undefined
      : () => dispatch(FsGen.createSetSortSetting({path, sortSetting: Types.SortSetting.NameDesc})),
  sortByTimeAsc:
    path === Constants.defaultPath
      ? undefined
      : () => dispatch(FsGen.createSetSortSetting({path, sortSetting: Types.SortSetting.TimeAsc})),
  sortByTimeDesc:
    path === Constants.defaultPath
      ? undefined
      : () => dispatch(FsGen.createSetSortSetting({path, sortSetting: Types.SortSetting.TimeDesc})),
})

export default Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, {path}: OwnProps) => ({
    sortSetting: Constants.showSortSetting(path, stateProps._pathItem, stateProps._kbfsDaemonStatus)
      ? stateProps._sortSetting
      : undefined,
    ...dispatchProps,
  }),
  'TopBarSort'
)(Sort)
