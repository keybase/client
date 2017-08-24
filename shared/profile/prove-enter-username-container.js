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

type State = {
  username: ?string,
}

class ProveEnterUsernameContainer extends Component<any, State> {
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

const connector = new TypedConnector()

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
