import * as Container from '../../util/container'
import Browser from '.'
import type * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'

type OwnProps = {path: Types.Path}

export default (ownProps: OwnProps) => {
  const {path} = ownProps
  const _kbfsDaemonStatus = Container.useSelector(state => state.fs.kbfsDaemonStatus)
  const _pathItem = Container.useSelector(state => Constants.getPathItem(state.fs.pathItems, path))
  const resetBannerType = Container.useSelector(state => Constants.resetBannerType(state, path))
  const props = {
    offlineUnsynced: Constants.isOfflineUnsynced(_kbfsDaemonStatus, _pathItem, path),
    path,
    resetBannerType,
    writable: _pathItem.writable,
  }
  return <Browser {...props} />
}
