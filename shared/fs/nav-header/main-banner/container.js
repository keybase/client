// @flow
import Banner from './index'
import * as FsGen from '../../../actions/fs-gen'
import {namedConnect} from '../../../util/container'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'

type OwnProps = {||}

const mapStateToProps = state => ({
  _kbfsDaemonStatus: state.fs.kbfsDaemonStatus,
  _name: state.config.username,
  _overallSyncStatus: state.fs.overallSyncStatus,
})

const mapDispatchToProps = dispatch => ({
  // This LoadPathMetadata triggers a sync retry.
  _onRetry: name => () =>
    dispatch(FsGen.createLoadPathMetadata({path: Types.stringToPath('/keybase/private' + name)})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  bannerType: Constants.getMainBannerType(stateProps._kbfsDaemonStatus, stateProps._overallSyncStatus),
  onRetry: dispatchProps._onRetry(stateProps._name),
})

const ConnectedBanner = namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'MainBanner'
)(Banner)

export default ConnectedBanner
