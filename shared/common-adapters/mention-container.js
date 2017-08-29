// @flow
import React from 'react'
import {connect} from 'react-redux'
import * as Selectors from '../constants/selectors'
import Mention from './mention'
import {showUserProfile} from '../actions/profile'
import {getProfile} from '../actions/tracker'
import {isMobile} from '../constants/platform'

import type {TypedState} from '../constants/reducer'
import type {Props as MentionProps} from './mention'

type OwnProps = {username: string, service: string}

const mapStateToProps = (
  state: TypedState,
  {username, service}: OwnProps
): {theme: $PropertyType<MentionProps, 'theme'>} => {
  if (service !== 'keybase') {
    console.warn('Non keybase service not implmented for mentions')
    return {theme: 'none'}
  }

  if (Selectors.usernameSelector(state) === username) {
    return {theme: 'highlight'}
  }

  if (Selectors.amIFollowing(state, username)) {
    return {theme: 'follow'}
  }

  return {theme: 'nonFollow'}
}

const mapDispatchToProps = (dispatch, {username}: OwnProps) => ({
  onClick: () => {
    isMobile ? dispatch(showUserProfile(username)) : dispatch(getProfile(username, true, true))
  },
})

// $FlowIssue
const Connected: React.ComponentType<OwnProps> = connect(mapStateToProps, mapDispatchToProps)(Mention)
export default Connected
