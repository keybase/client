import * as C from '../../../constants'
import * as Constants from '../../../constants/fs'
import Banner from './index'
import * as T from '../../../constants/types'

const ConnectedBanner = () => {
  const _kbfsDaemonStatus = C.useFSState(s => s.kbfsDaemonStatus)
  const _name = C.useCurrentUserState(s => s.username)
  const _overallSyncStatus = C.useFSState(s => s.overallSyncStatus)

  const loadPathMetadata = C.useFSState(s => s.dispatch.loadPathMetadata)
  // This LoadPathMetadata triggers a sync retry.
  const onRetry = () => {
    loadPathMetadata(T.FS.stringToPath('/keybase/private' + _name))
  }

  const props = {
    bannerType: Constants.getMainBannerType(_kbfsDaemonStatus, _overallSyncStatus),
    onRetry,
  }
  return <Banner {...props} />
}

export default ConnectedBanner
