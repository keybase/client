import * as Container from '../../util/container'
import Sort from './sort'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'

type OwnProps = {
  path: Types.Path
}

export default (ownProps: OwnProps) => {
  const {path} = ownProps
  const _kbfsDaemonStatus = Constants.useState(s => s.kbfsDaemonStatus)
  const _pathItem = Constants.useState(s => Constants.getPathItem(s.pathItems, path))
  const _sortSetting = Container.useSelector(
    state => Constants.getPathUserSetting(state.fs.pathUserSettings, path).sort
  )
  const dispatch = Container.useDispatch()

  const sortByNameAsc =
    path === Constants.defaultPath
      ? undefined
      : () => {
          dispatch(FsGen.createSortSetting({path, sortSetting: Types.SortSetting.NameAsc}))
        }
  const sortByNameDesc =
    path === Constants.defaultPath
      ? undefined
      : () => {
          dispatch(FsGen.createSortSetting({path, sortSetting: Types.SortSetting.NameDesc}))
        }
  const sortByTimeAsc =
    path === Constants.defaultPath
      ? undefined
      : () => {
          dispatch(FsGen.createSortSetting({path, sortSetting: Types.SortSetting.TimeAsc}))
        }
  const sortByTimeDesc =
    path === Constants.defaultPath
      ? undefined
      : () => {
          dispatch(FsGen.createSortSetting({path, sortSetting: Types.SortSetting.TimeDesc}))
        }
  const props = {
    sortByNameAsc,
    sortByNameDesc,
    sortByTimeAsc,
    sortByTimeDesc,
    sortSetting: Constants.showSortSetting(path, _pathItem, _kbfsDaemonStatus) ? _sortSetting : undefined,
  }
  return <Sort {...props} />
}
