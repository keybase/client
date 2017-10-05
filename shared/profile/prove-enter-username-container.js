// @flow
import React, {Component} from 'react'
import ProveEnterUsername from './prove-enter-username'
import {connect, type TypedState} from '../util/container'
import * as Creators from '../actions/profile'

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

const mapStateToProps = (state: TypedState) => {
  const profile = state.profile

  if (!profile.platform) {
    throw new Error('No platform passed to prove enter username')
  }

  return {
    canContinue: true,
    errorCode: profile.errorCode,
    errorText: profile.errorText,
    platform: profile.platform,
    title: 'Add Proof',
    username: profile.username,
    waiting: profile.waiting,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onContinue: (username: string, platform: ?string) => {
    dispatch(Creators.updateUsername(username))

    if (platform === 'btc') {
      dispatch(Creators.submitBTCAddress())
    } else if (platform === 'zcash') {
      dispatch(Creators.submitZcashAddress())
    } else {
      dispatch(Creators.submitUsername())
    }
  },
  onCancel: () => dispatch(Creators.cancelAddProof()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  ...ownProps,
  onContinue: (username: string) => dispatchProps._onContinue(username, stateProps.platform),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(ProveEnterUsernameContainer)
