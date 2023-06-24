import Banner from './index'
import * as ConfigConstants from '../../../constants/config'
import * as FsGen from '../../../actions/fs-gen'
import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'

const ConnectedBanner = () => {
  const _kbfsDaemonStatus = Constants.useState(s => s.kbfsDaemonStatus)
  const _name = ConfigConstants.useCurrentUserState(s => s.username)
  const _overallSyncStatus = Container.useSelector(state => state.fs.overallSyncStatus)
  const dispatch = Container.useDispatch()
  // This LoadPathMetadata triggers a sync retry.
  const onRetry = () => {
    dispatch(FsGen.createLoadPathMetadata({path: Types.stringToPath('/keybase/private' + _name)}))
  }

  const props = {
    bannerType: Constants.getMainBannerType(_kbfsDaemonStatus, _overallSyncStatus),
    onRetry,
  }
  return <Banner {...props} />
}

export default ConnectedBanner
