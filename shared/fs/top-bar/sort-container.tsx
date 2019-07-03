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
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
  _sortSetting: Constants.getPathUserSetting(state.fs.pathUserSettings, path).sort,
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch, {path}: OwnProps) => ({
  sortByNameAsc:
    path === Constants.defaultPath
      ? undefined
      : () => dispatch(FsGen.createSortSetting({path, sortSetting: Types.SortSetting.NameAsc})),
  sortByNameDesc:
    path === Constants.defaultPath
      ? undefined
      : () => dispatch(FsGen.createSortSetting({path, sortSetting: Types.SortSetting.NameDesc})),
  sortByTimeAsc:
    path === Constants.defaultPath
      ? undefined
      : () => dispatch(FsGen.createSortSetting({path, sortSetting: Types.SortSetting.TimeAsc})),
  sortByTimeDesc:
    path === Constants.defaultPath
      ? undefined
      : () => dispatch(FsGen.createSortSetting({path, sortSetting: Types.SortSetting.TimeDesc})),
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
