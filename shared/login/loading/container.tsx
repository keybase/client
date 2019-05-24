import * as Constants from '../../constants/config'
import * as ConfigGen from '../../actions/config-gen'
import Splash from '.'
import {connect, isMobile} from '../../util/container'

type OwnProps = {
  navigateAppend: (...args: Array<any>) => any
}

const mapStateToProps = state => ({
  _failedReason: state.config.daemonHandshakeFailedReason,
  _retriesLeft: state.config.daemonHandshakeRetriesLeft,
})

const mapDispatchToProps = (dispatch, {navigateAppend}) => ({
  _onFeedback: () => dispatch(navigateAppend(['feedback'])),
  _onRetry: () => dispatch(ConfigGen.createStartHandshake()),
})

const mergeProps = (stateProps, dispatchProps) => {
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

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Splash)
