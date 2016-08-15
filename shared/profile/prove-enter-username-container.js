// @flow
import ProveEnterUsername from './prove-enter-username'
import React, {Component} from 'react'
import type {Props} from './prove-enter-username'
import type {TypedDispatch} from '../constants/types/flux'
import type {TypedState} from '../constants/reducer'
import {TypedConnector} from '../util/typed-connect'
import {submitUsername, cancelAddProof, updateUsername, submitBTCAddress} from '../actions/profile'

class ProveEnterUsernameContainer extends Component<void, any, void> {
  static parseRoute (currentPath, uri) {
    return {componentAtTop: {title: 'Enter Username'}}
  }

  render () {
    return <ProveEnterUsername {...this.props} />
  }
}

const connector: TypedConnector<TypedState, TypedDispatch<{}>, {}, Props> = new TypedConnector()

export default connector.connect(
  (state, dispatch, ownProps) => {
    const profile = state.profile

    if (!profile.platform) {
      throw new Error('No platform passed to prove enter username')
    }

    return {
      canContinue: profile.usernameValid,
      errorCode: profile.errorCode,
      errorText: profile.errorText,
      onCancel: () => { dispatch(cancelAddProof()) },
      onContinue: profile.platform === 'btc' ? () => { dispatch(submitBTCAddress()) } : () => { dispatch(submitUsername()) },
      onUsernameChange: (username: string) => { dispatch(updateUsername(username)) },
      platform: profile.platform,
      username: profile.username,
      waiting: profile.waiting,
    }
  }
)(ProveEnterUsernameContainer)
