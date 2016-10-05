// @flow
import PostProof from './post-proof'
import React, {Component} from 'react'
import {TypedConnector} from '../util/typed-connect'
import {cancelAddProof, checkProof, outputInstructionsActionLink} from '../actions/profile'

import type {Props} from './post-proof'
import type {ProvablePlatformsType} from '../constants/types/more'
import type {TypedDispatch} from '../constants/types/flux'
import type {TypedState} from '../constants/reducer'

class PostProofContainer extends Component<void, any, void> {
  static parseRoute (currentPath, uri) {
    return {componentAtTop: {title: ''}}
  }

  render () {
    return <PostProof {...this.props} />
  }
}

const connector: TypedConnector<TypedState, TypedDispatch<{}>, {}, Props> = new TypedConnector()

export default connector.connect(
  (state, dispatch, ownProps) => {
    const profile = state.profile

    if (!profile.platform ||
      profile.platform === 'btc' ||
      profile.platform === 'dnsOrGenericWebSite' ||
      profile.platform === 'pgp' ||
      profile.platform === 'pgpg') {
      throw new Error(`Invalid profile platform in PostProofContainer: ${profile.platform || ''}`)
    }

    const platform: ProvablePlatformsType = profile.platform

    return {
      errorMessage: profile.errorText,
      isOnCompleteWaiting: profile.waiting,
      onCancel: () => { dispatch(cancelAddProof()) },
      onCancelText: 'Cancel',
      onComplete: () => { dispatch(checkProof()) },
      platform,
      platformUserName: profile.username,
      proofAction: () => { dispatch(outputInstructionsActionLink()) },
      proofText: profile.proofText || '',
    }
  }
)(PostProofContainer)
