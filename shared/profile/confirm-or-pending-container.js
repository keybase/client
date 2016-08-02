// @flow
import React, {Component} from 'react'
import ConfirmOrPending from './confirm-or-pending'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import {cancelAddProof, reloadProfile} from '../actions/profile'
import {proveCommon} from '../constants/types/keybase-v1'
import {globalColors} from '../styles/style-guide'

class ConfirmOrPendingContainer extends Component<void, any, void> {
  static parseRoute (currentPath, uri) {
    return {
      componentAtTop: {
        title: '',
      },
    }
  }

  render () {
    return <ConfirmOrPending {...this.props} />
  }
}

export default connect(
  state => {
    const profile = state.profile
    const isGood = profile.proofFound && profile.proofStatus === proveCommon.ProofStatus.ok

    return {
      platform: profile.platform,
      titleColor: isGood ? globalColors.green : globalColors.blue,
      username: profile.username,
      platformIconOverlayColor: isGood ? globalColors.green : globalColors.grey,
    }
  },
  dispatch => (
    bindActionCreators({
      onCancel: () => cancelAddProof(),
      onReloadProfile: () => reloadProfile(),
    }, dispatch))
)(ConfirmOrPendingContainer)
