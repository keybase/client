import Banner from './index'
import * as FsGen from '../../../actions/fs-gen'
import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'

type OwnProps = {}

const ConnectedBanner = Container.connect(
  state => ({
    _kbfsDaemonStatus: state.fs.kbfsDaemonStatus,
    _name: state.config.username,
    _overallSyncStatus: state.fs.overallSyncStatus,
  }),
  dispatch => ({
    // This LoadPathMetadata triggers a sync retry.
    _onRetry: (name: string) => () =>
      dispatch(FsGen.createLoadPathMetadata({path: Types.stringToPath('/keybase/private' + name)})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    bannerType: Constants.getMainBannerType(stateProps._kbfsDaemonStatus, stateProps._overallSyncStatus),
    onRetry: dispatchProps._onRetry(stateProps._name),
  })
)(Banner)

export default ConnectedBanner
