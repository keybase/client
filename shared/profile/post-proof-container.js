// @flow
import React, {Component} from 'react'
import PostProof from './post-proof'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import {cancelAddProof, submitOutputInstructions, outputInstructionsActionLink} from '../actions/profile'

class PostProofContainer extends Component<void, any, void> {
  static parseRoute (currentPath, uri) {
    return {
      componentAtTop: {
        title: '',
      },
    }
  }

  render () {
    return <PostProof {...this.props} />
  }
}

export default connect(
  state => {
    const profile = state.profile
    return {
      isOnCompleteWaiting: profile.waiting,
      platform: profile.platform,
      errorMessage: profile.error,
      platformUserName: profile.username,
      proofText: profile.proof,
      onCancelText: 'Cancel',
    }
  },
  dispatch => (
    bindActionCreators({
      onCancel: () => cancelAddProof(),
      onComplete: () => submitOutputInstructions(),
      proofAction: () => outputInstructionsActionLink(),
    }, dispatch))
)(PostProofContainer)
