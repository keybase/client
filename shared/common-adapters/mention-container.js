// @flow
import * as Selectors from '../constants/selectors'
import Mention, {type Props as MentionProps} from './mention'
import React from 'react'
import {connect, type TypedState} from '../util/container'
import {getProfile} from '../actions/tracker'
import {isMobile} from '../constants/platform'
import {showUserProfile} from '../actions/profile'

type OwnProps = {username: string, service: string}

const isSpecialCaseHighlight = (username: string) =>
  username === 'channel' || username === 'here' || username === 'everyone'

const mapStateToProps = (
  state: TypedState,
  {username, service}: OwnProps
): {theme: $PropertyType<MentionProps, 'theme'>} => {
  if (service !== 'keybase') {
    console.warn('Non keybase service not implmented for mentions')
    return {theme: 'none'}
  }

  if (isSpecialCaseHighlight(username)) {
    return {theme: 'highlight'}
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
  onClick: isSpecialCaseHighlight(username)
    ? undefined
    : () => {
        isMobile ? dispatch(showUserProfile(username)) : dispatch(getProfile(username, true, true))
      },
})

// $FlowIssue
const Connected: React.ComponentType<OwnProps> = connect(mapStateToProps, mapDispatchToProps)(Mention)
export default Connected
