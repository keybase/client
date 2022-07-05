import * as Constants from '../../constants/config'
import * as ConfigGen from '../../actions/config-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import Splash from '.'
import {connect, isMobile} from '../../util/container'

type OwnProps = {}

export default connect(
  state => ({
    _failedReason: state.config.daemonHandshakeFailedReason,
    _retriesLeft: state.config.daemonHandshakeRetriesLeft,
  }),
  dispatch => ({
    _onFeedback: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['feedback']})),
    _onRetry: () => dispatch(ConfigGen.createStartHandshake()),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    let status = ''
    let failed = ''

    // Totally failed
    if (stateProps._retriesLeft === 0) {
      failed = stateProps._failedReason
    } else if (stateProps._retriesLeft === Constants.maxHandshakeTries) {
      // First try
      status = 'Loading...'
    } else {
      const failed = stateProps._failedReason ? `: ${stateProps._failedReason}` : ''
      status = `Loading...  (still trying${failed})`
    }

    return {
      failed,
      onFeedback: isMobile ? dispatchProps._onFeedback : null,
      onRetry: stateProps._retriesLeft === 0 ? dispatchProps._onRetry : null,
      status,
    }
  }
)(Splash)
