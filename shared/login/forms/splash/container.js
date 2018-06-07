// @flow
import * as Constants from '../../../constants/config'
import * as ConfigGen from '../../../actions/config-gen'
import Splash from '.'
import {connect, type TypedState, type Dispatch, isMobile} from '../../../util/container'

const mapStateToProps = (state: TypedState) => ({
  _stillTrying: state.config.bootstrapTriesRemaining !== Constants.maxBootstrapTries,
  failed: state.config.bootStatus === 'bootStatusFailure',
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateAppend}) => ({
  _onFeedback: () => dispatch(navigateAppend(['feedback'])),
  _onRetry: () => dispatch(ConfigGen.createRetryBootstrap()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  let status
  if (stateProps.failed) {
    status =
      'Oops, we had a problem communicating with our services. This might be because you lost connectivity.'
  } else {
    status = stateProps._stillTrying ? 'Loading...  (still trying)' : 'Loading...'
  }

  return {
    failed: stateProps.failed,
    onFeedback: isMobile ? dispatchProps._onFeedback : null,
    onRetry: stateProps.failed ? dispatchProps._onRetry : null,
    status,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Splash)
