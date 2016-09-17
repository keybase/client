// @flow
import {error as proofError} from '../constants/tracker'
import {globalColors} from '../styles'

import type {SimpleProofState, UserInfo} from '../constants/tracker'

function followLabel (userInfo: UserInfo, currentlyFollowing: boolean): ?string {
  if (userInfo.followsYou && currentlyFollowing) {
    return 'You follow each other'
  } else if (userInfo.followsYou) {
    return 'Follows you'
  }
  return null
}

function usernameStyle ({currentlyFollowing, trackerState}: {currentlyFollowing: boolean, trackerState: SimpleProofState}): Object {
  if (trackerState === proofError) {
    return {color: globalColors.red}
  }
  if (currentlyFollowing) {
    return {color: globalColors.green2}
  }
  return {color: globalColors.orange}
}

function headerColor ({currentlyFollowing, trackerState}: {currentlyFollowing: boolean, trackerState: SimpleProofState}): string {
  if (trackerState === proofError) return globalColors.red
  if (currentlyFollowing) return globalColors.green
  return globalColors.blue
}

export {
  followLabel,
  headerColor,
  usernameStyle,
}
