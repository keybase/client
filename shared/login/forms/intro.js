// @flow
import * as Constants from '../../constants/config'
import {Splash, Intro, Failure} from '.'
import {connect} from 'react-redux'
import {feedbackTab} from '../../constants/settings'
import {loginTab, settingsTab} from '../../constants/tabs'
import {navigateTo} from '../../actions/route-tree'
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

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onFeedback: () => {
    dispatch(navigateTo([settingsTab, feedbackTab]))
  },
  onLogin: () => {
    dispatch(Creators.setLoginFromRevokedDevice(''))
    dispatch(Creators.setRevokedSelf(''))
    dispatch(Creators.setDeletedSelf(''))
    dispatch(navigateTo([loginTab, 'login']))
    dispatch(Creators.startLogin())
  },
  onRetry: () => {
    dispatch(retryBootstrap())
  },
  onSignup: () => {
    dispatch(Creators.setLoginFromRevokedDevice(''))
    dispatch(Creators.setRevokedSelf(''))
    dispatch(Creators.setDeletedSelf(''))
    dispatch(requestAutoInvite())
  },
})
export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  branch(props => props.bootStatus === 'bootStatusLoading', renderComponent(Splash)),
  branch(props => props.bootStatus === 'bootStatusFailure', renderComponent(Failure))
)(Intro)
