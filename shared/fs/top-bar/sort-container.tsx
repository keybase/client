import * as C from '../../constants'
import * as Constants from '../../constants/fs'
import Sort from './sort'
import * as Types from '../../constants/types/fs'

type OwnProps = {
  path: Types.Path
}

export default (ownProps: OwnProps) => {
  const {path} = ownProps
  const _kbfsDaemonStatus = C.useFSState(s => s.kbfsDaemonStatus)
  const _pathItem = C.useFSState(s => C.getPathItem(s.pathItems, path))

  const setSorting = C.useFSState(s => s.dispatch.setSorting)
  const _sortSetting = C.useFSState(s => Constants.getPathUserSetting(s.pathUserSettings, path).sort)

  const sortByNameAsc =
    path === C.defaultPath
      ? undefined
      : () => {
          setSorting(path, Types.SortSetting.NameAsc)
        }
  const sortByNameDesc =
    path === C.defaultPath
      ? undefined
      : () => {
          setSorting(path, Types.SortSetting.NameDesc)
        }
  const sortByTimeAsc =
    path === C.defaultPath
      ? undefined
      : () => {
          setSorting(path, Types.SortSetting.TimeAsc)
        }
  const sortByTimeDesc =
    path === C.defaultPath
      ? undefined
      : () => {
          setSorting(path, Types.SortSetting.TimeDesc)
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
