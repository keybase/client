// @flow
import * as React from 'react'
// import * as Constants from '../../constants/config'
// import * as LoginGen from '../../actions/login-gen'
// import * as ConfigGen from '../../actions/config-gen'
// import {Splash, Intro, Failure} from '.'
import {connect, type TypedState} from '../../util/container'
// import {requestAutoInvite} from '../../actions/signup'
import Splash from './splash/container'

const mapStateToProps = (state: TypedState) => ({
  bootStatus: state.config.bootStatus,
  // justDeletedSelf: state.login.justDeletedSelf,
  // justRevokedSelf: state.login.justRevokedSelf,
  // retrying: state.config.bootstrapTriesRemaining !== Constants.maxBootstrapTries,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateAppend}) => ({
  // onFeedback: () => dispatch(navigateAppend(['feedback'])),
  // onLogin: () => dispatch(LoginGen.createStartLogin()),
  // onRetry: () => dispatch(ConfigGen.createRetryBootstrap()),
  // onSignup: () => dispatch(requestAutoInvite()),
})

const Switcher = ({bootStatus}) => {
  switch (bootStatus) {
    case 'bootStatusLoading':
    case 'bootStatusFailure':
      return <Splash />
    // default:
    // return <Intro />
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Switcher)
