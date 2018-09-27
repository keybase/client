// @flow
import {compose, connect, setDisplayName, type TypedState} from '../../util/container'
import SortBar from './sortbar'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'

type OwnProps = {
  path: Types.Path,
}

const mapStateToProps = (state: TypedState, {path}: OwnProps) => ({
  sortSetting: state.fs.pathUserSettings.get(path, Constants.makePathUserSetting()).get('sort'),
  folderIsPending: state.fs.loadingPaths.has(path),
})

const mapDispatchToProps = (dispatch, {path}) => ({
  sortSettingToAction: (sortSetting: Types.SortSetting) => () => {
    dispatch(FsGen.createSortSetting({path, sortSetting}))
  },
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  setDisplayName('SortBar')
)(SortBar)
