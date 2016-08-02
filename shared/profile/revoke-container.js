// @flow
import React, {Component} from 'react'
import Revoke from './revoke'
import {TypedConnector} from '../util/typed-connect'
import {bindActionCreators} from 'redux'
import {submitRevokeProof, cancelRevokeProof} from '../actions/profile'

import type {Props} from './revoke'
import type {TypedState} from '../constants/reducer'
import type {TypedDispatch} from '../constants/types/flux'

type OwnProps = {
  platform: string,
  proofId: string,
  platformHandle: string,
}

class RevokeContainer extends Component<void, Props, void> {
  static parseRoute (currentPath, uri) {
    return {
      componentAtTop: {
        title: 'Revoke Proof',
        props: {
          platform: currentPath.get('platform'),
          proofId: currentPath.get('proofId'),
          platformHandle: currentPath.get('platformHandle'),
        },
      },
    }
  }

  render () {
    return <Revoke {...this.props} />
  }
}

const connector: TypedConnector<TypedState, TypedDispatch<{}>, OwnProps, Props> = new TypedConnector()

export default connector.connect(
  (state, dispatch, ownProps) => ({
    waiting: state.profile.revoke.waiting,
    errorMessage: state.profile.revoke.error,
    ...bindActionCreators({
      onCancel: () => cancelRevokeProof(),
      onRevoke: () => submitRevokeProof(ownProps.proofId),
    }, dispatch),
    ...ownProps,
  })
)(RevokeContainer)
