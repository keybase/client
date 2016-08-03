// @flow
import React, {Component} from 'react'
import ProveEnterUsername from './prove-enter-username'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import {submitUsername, cancelAddProof, updateUsername} from '../actions/profile'

class ProveEnterUsernameContainer extends Component<void, any, void> {
  static parseRoute (currentPath, uri) {
    return {
      componentAtTop: {
        title: 'Enter Username',
      },
    }
  }

  render () {
    return <ProveEnterUsername {...this.props} />
  }
}

export default connect(
  state => {
    const profile = state.profile
    return {
      waiting: profile.waiting,
      username: profile.username,
      platform: profile.platform,
      canContinue: profile.usernameValid,
    }
  },
  dispatch => (
    bindActionCreators({
      onUsernameChange: (username: string) => updateUsername(username),
      onCancel: () => cancelAddProof(),
      onContinue: () => submitUsername(),
    }, dispatch))
)(ProveEnterUsernameContainer)
