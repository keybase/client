import Sort from './sort'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'

type OwnProps = {
  path: Types.Path
}

export default (ownProps: OwnProps) => {
  const {path} = ownProps
  const _kbfsDaemonStatus = Constants.useState(s => s.kbfsDaemonStatus)
  const _pathItem = Constants.useState(s => Constants.getPathItem(s.pathItems, path))

  const setSorting = Constants.useState(s => s.dispatch.setSorting)
  const _sortSetting = Constants.useState(s => Constants.getPathUserSetting(s.pathUserSettings, path).sort)

  const sortByNameAsc =
    path === Constants.defaultPath
      ? undefined
      : () => {
          setSorting(path, Types.SortSetting.NameAsc)
        }
  const sortByNameDesc =
    path === Constants.defaultPath
      ? undefined
      : () => {
          setSorting(path, Types.SortSetting.NameDesc)
        }
  const sortByTimeAsc =
    path === Constants.defaultPath
      ? undefined
      : () => {
          setSorting(path, Types.SortSetting.TimeAsc)
        }
  const sortByTimeDesc =
    path === Constants.defaultPath
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
