// @flow
import React, {Component} from 'react'
import ProveEnterUsername from './prove-enter-username'
import {TypedConnector} from '../util/typed-connect'
import {
  submitUsername,
  cancelAddProof,
  updateUsername,
  submitBTCAddress,
  submitZcashAddress,
} from '../actions/profile'

import type {Props} from './prove-enter-username'
import type {TypedDispatch} from '../constants/types/flux'
import type {TypedState} from '../constants/reducer'

type State = {
  username: ?string,
}

class ProveEnterUsernameContainer extends Component<void, any, State> {
  state: State
  constructor() {
    super()
    this.state = {username: null}
  }

  render() {
    return (
      <ProveEnterUsername
        {...this.props}
        onUsernameChange={username => this.setState({username})}
        onContinue={() => this.props.onContinue(this.state.username)}
      />
    )
  }
}

const connector: TypedConnector<TypedState, TypedDispatch<{}>, {}, Props> = new TypedConnector()

export default connector.connect((state, dispatch, ownProps) => {
  const profile = state.profile

  if (!profile.platform) {
    throw new Error('No platform passed to prove enter username')
  }

  return {
    canContinue: true,
    errorCode: profile.errorCode,
    errorText: profile.errorText,
    title: 'Add Proof',
    onCancel: () => {
      dispatch(cancelAddProof())
    },
    onContinue: (username: string) => {
      dispatch(updateUsername(username))

      if (profile.platform === 'btc') {
        dispatch(submitBTCAddress())
      } else if (profile.platform === 'zcash') {
        dispatch(submitZcashAddress())
      } else {
        dispatch(submitUsername())
      }
    },
    platform: profile.platform,
    username: profile.username,
    waiting: profile.waiting,
  }
})(ProveEnterUsernameContainer)
