import * as Container from '../../util/container'
import Browser from '.'
import type * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'

type OwnProps = {
  path: Types.Path
}

export default Container.connect(
  (state, {path}: OwnProps) => ({
    _kbfsDaemonStatus: state.fs.kbfsDaemonStatus,
    _pathItem: Constants.getPathItem(state.fs.pathItems, path),
    _tlf: Constants.getTlfFromPath(state.fs.tlfs, path),
    resetBannerType: Constants.resetBannerType(state, path),
  }),
  () => ({}),
  (stateProps, _, {path}: OwnProps) => ({
    offlineUnsynced: Constants.isOfflineUnsynced(stateProps._kbfsDaemonStatus, stateProps._pathItem, path),
    path,
    resetBannerType: stateProps.resetBannerType,
    writable: stateProps._pathItem.writable,
  })
)(Browser)
