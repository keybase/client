import * as C from '@/constants'
import * as Constants from '@/constants/fs'
import Sort from './sort'
import * as T from '@/constants/types'

type OwnProps = {
  path: T.FS.Path
}

const Container = (ownProps: OwnProps) => {
  const {path} = ownProps
  const _kbfsDaemonStatus = C.useFSState(s => s.kbfsDaemonStatus)
  const _pathItem = C.useFSState(s => C.FS.getPathItem(s.pathItems, path))

  const setSorting = C.useFSState(s => s.dispatch.setSorting)
  const _sortSetting = C.useFSState(s => Constants.getPathUserSetting(s.pathUserSettings, path).sort)

  const sortByNameAsc =
    path === C.FS.defaultPath
      ? undefined
      : () => {
          setSorting(path, T.FS.SortSetting.NameAsc)
        }
  const sortByNameDesc =
    path === C.FS.defaultPath
      ? undefined
      : () => {
          setSorting(path, T.FS.SortSetting.NameDesc)
        }
  const sortByTimeAsc =
    path === C.FS.defaultPath
      ? undefined
      : () => {
          setSorting(path, T.FS.SortSetting.TimeAsc)
        }
  const sortByTimeDesc =
    path === C.FS.defaultPath
      ? undefined
      : () => {
          setSorting(path, T.FS.SortSetting.TimeDesc)
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

export default Container
