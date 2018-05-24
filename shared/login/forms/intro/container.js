// @flow
import * as LoginGen from '../../../actions/login-gen'
import {requestAutoInvite} from '../../../actions/signup'
import Intro from '.'
import {connect, type TypedState, type Dispatch, isMobile} from '../../../util/container'

const mapStateToProps = (state: TypedState) => {
  let bannerMessage = null

  if (state.login.justDeletedSelf) {
    bannerMessage = `Your Keybase account ${state.login.justDeletedSelf}" has been deleted. Au revoir!`
  } else if (state.login.justRevokedSelf) {
    bannerMessage = `${state.login.justRevokedSelf} was revoked successfully`
  }

  return {bannerMessage}
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateAppend}) => ({
  _onFeedback: () => dispatch(navigateAppend(['feedback'])),
  onLogin: () => dispatch(LoginGen.createStartLogin()),
  onSignup: () => dispatch(requestAutoInvite()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  bannerMessage: stateProps.bannerMessage,
  onFeedback: isMobile ? dispatchProps._onFeedback : null,
  onLogin: dispatchProps.onLogin,
  onSignup: dispatchProps.onSignup,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Intro)
