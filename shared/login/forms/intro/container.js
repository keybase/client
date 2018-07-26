// @flow
import * as ProvisionGen from '../../../actions/provision-gen'
import * as SignupGen from '../../../actions/signup-gen'
import Intro from '.'
import {connect, type TypedState, type Dispatch, isMobile} from '../../../util/container'

type OwnProps = {
  navigateAppend: (...Array<any>) => any,
}

const mapStateToProps = (state: TypedState) => {
  let bannerMessage = null

  if (state.login.justDeletedSelf) {
    bannerMessage = `Your Keybase account ${state.login.justDeletedSelf}" has been deleted. Au revoir!`
  } else if (state.login.justRevokedSelf) {
    bannerMessage = `${state.login.justRevokedSelf} was revoked successfully`
  }

  return {bannerMessage}
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateAppend}: OwnProps) => ({
  _onFeedback: () => dispatch(navigateAppend(['feedback'])),
  onLogin: () => dispatch(ProvisionGen.createStartProvision()),
  onSignup: () => dispatch(SignupGen.createRequestAutoInvite()),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  bannerMessage: stateProps.bannerMessage,
  onFeedback: isMobile ? dispatchProps._onFeedback : null,
  onLogin: dispatchProps.onLogin,
  onSignup: dispatchProps.onSignup,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Intro)
