import Banner from './index'
import * as ConfigConstants from '../../../constants/config'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'

const ConnectedBanner = () => {
  const _kbfsDaemonStatus = Constants.useState(s => s.kbfsDaemonStatus)
  const _name = ConfigConstants.useCurrentUserState(s => s.username)
  const _overallSyncStatus = Constants.useState(s => s.overallSyncStatus)

  const loadPathMetadata = Constants.useState(s => s.dispatch.loadPathMetadata)
  // This LoadPathMetadata triggers a sync retry.
  const onRetry = () => {
    loadPathMetadata(Types.stringToPath('/keybase/private' + _name))
  }

  const props = {
    bannerType: Constants.getMainBannerType(_kbfsDaemonStatus, _overallSyncStatus),
    onRetry,
  }
  return <Banner {...props} />
}

export default ConnectedBanner
