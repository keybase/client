// @flow
import * as Constants from '../../constants/config'
import {Splash, Intro, Failure} from '.'
import {connect} from 'react-redux-profiled'
import {retryBootstrap} from '../../actions/config'
import * as Creators from '../../actions/login/creators'
import {requestAutoInvite} from '../../actions/signup'
import {compose, branch, renderComponent} from 'recompose'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState) => ({
  bootStatus: state.config.bootStatus,
  justDeletedSelf: state.login.justDeletedSelf,
  justLoginFromRevokedDevice: state.login.justLoginFromRevokedDevice,
  justRevokedSelf: state.login.justRevokedSelf,
  retrying: state.config.bootstrapTriesRemaining !== Constants.MAX_BOOTSTRAP_TRIES,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateAppend}) => ({
  onFeedback: () => {
    dispatch(navigateAppend(['feedback']))
  },
  onLogin: () => {
    dispatch(Creators.startLogin())
  },
  onRetry: () => {
    dispatch(retryBootstrap())
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
