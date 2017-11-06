// @flow
import * as Constants from '../../constants/config'
import * as Creators from '../../actions/login/creators'
import * as ConfigGen from '../../actions/config-gen'
import {Splash, Intro, Failure} from '.'
import {connect, type TypedState, compose, branch, renderComponent} from '../../util/container'
import {requestAutoInvite} from '../../actions/signup'

const mapStateToProps = (state: TypedState) => ({
  bootStatus: state.config.bootStatus,
  justDeletedSelf: state.login.justDeletedSelf,
  justLoginFromRevokedDevice: state.login.justLoginFromRevokedDevice,
  justRevokedSelf: state.login.justRevokedSelf,
  retrying: state.config.bootstrapTriesRemaining !== Constants.maxBootstrapTries,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateAppend}) => ({
  onFeedback: () => {
    dispatch(navigateAppend(['feedback']))
  },
  onLogin: () => {
    dispatch(Creators.startLogin())
  },
  onRetry: () => {
    dispatch(ConfigGen.createRetryBootstrap())
  },
  onSignup: () => {
    dispatch(requestAutoInvite())
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  branch(props => props.bootStatus === 'bootStatusLoading', renderComponent(Splash)),
  branch(props => props.bootStatus === 'bootStatusFailure', renderComponent(Failure))
)(Intro)
