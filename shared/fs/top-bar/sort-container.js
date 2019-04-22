// @flow
import {namedConnect} from '../../util/container'
import Sort from './sort'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'

type OwnProps = {|
  path: Types.Path,
|}

const mapStateToProps = (state, {path}: OwnProps) => ({
  _isEmpty: Constants.isEmptyFolder(state.fs.pathItems, path),
  _sortSetting: state.fs.pathUserSettings.get(path, Constants.defaultPathUserSetting).sort,
})

const mapDispatchToProps = (dispatch, {path}) => ({
  sortByNameAsc:
    path === Constants.defaultPath
      ? undefined
      : () => dispatch(FsGen.createSortSetting({path, sortSetting: 'name-asc'})),
  sortByNameDesc:
    path === Constants.defaultPath
      ? undefined
      : () => dispatch(FsGen.createSortSetting({path, sortSetting: 'name-desc'})),
  sortByTimeAsc:
    Types.getPathLevel(path) < 3
      ? undefined
      : () => dispatch(FsGen.createSortSetting({path, sortSetting: 'time-asc'})),
  sortByTimeDesc:
    Types.getPathLevel(path) < 3
      ? undefined
      : () => dispatch(FsGen.createSortSetting({path, sortSetting: 'time-desc'})),
})

const mergeProps = (stateProps, dispatchProps, {path}: OwnProps) => ({
  sortSetting: path === Constants.defaultPath || stateProps._isEmpty ? undefined : stateProps._sortSetting,
  ...dispatchProps,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'TopBarSort'
)(Sort)
