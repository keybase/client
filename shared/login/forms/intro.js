// @flow
import {Splash, Intro, Failure} from '.'
import {connect} from 'react-redux'
import {loginTab} from '../../constants/tabs'
import {navigateTo} from '../../actions/route-tree'
import {retryBootstrap} from '../../actions/config'
import {setRevokedSelf, setDeletedSelf, setLoginFromRevokedDevice, login} from '../../actions/login'
import {requestAutoInvite} from '../../actions/signup'
import {compose, branch, renderComponent} from 'recompose'

import type {TypedState} from '../../constants/reducer'

export default compose(
  connect(
    (state: TypedState) => ({
      bootStatus: state.config.bootStatus,
      justDeletedSelf: state.login.justDeletedSelf,
      justLoginFromRevokedDevice: state.login.justLoginFromRevokedDevice,
      justRevokedSelf: state.login.justRevokedSelf,
    }),
    (dispatch: Dispatch) => ({
      onLogin: () => {
        dispatch(setLoginFromRevokedDevice(''))
        dispatch(setRevokedSelf(''))
        dispatch(setDeletedSelf(''))
        dispatch(navigateTo([loginTab, 'login']))
        dispatch(login())
      },
      onRetry: () => {
        dispatch(retryBootstrap())
      },
      onSignup: () => {
        dispatch(setLoginFromRevokedDevice(''))
        dispatch(setRevokedSelf(''))
        dispatch(setDeletedSelf(''))
        dispatch(requestAutoInvite())
      },
    })
  ),
  branch(
    props => props.bootStatus === 'bootStatusLoading',
    renderComponent(Splash)
  ),
  branch(
    props => props.bootStatus === 'bootStatusFailure',
    renderComponent(Failure)
  ),
)(Intro)
