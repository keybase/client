// @flow
import {Splash, Intro, Failure} from '.'
import {connect} from 'react-redux'
import {loginTab} from '../../constants/tabs'
import {navigateTo} from '../../actions/route-tree'
import {retryBootstrap} from '../../actions/config'
import * as Creators from '../../actions/login/creators'
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
