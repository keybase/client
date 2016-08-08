// @flow
import keybaseUrl from '../constants/urls'
import openUrl from '../util/open-url'
import type {SimpleProofState} from '../constants/tracker'
import type {UserInfo} from './user-bio'
import {error as proofError} from '../constants/tracker'
import {globalColors} from '../styles/style-guide'

function onClickAvatar (username: ?string) {
  username && openUrl(`${keybaseUrl}/${username}`)
}

function onClickFollowers (username: ?string) {
  username && openUrl(`${keybaseUrl}/${username}#profile-tracking-section`)
}

function onClickFollowing (username: ?string) {
  username && openUrl(`${keybaseUrl}/${username}#profile-tracking-section`)
}

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
  onClickAvatar,
  onClickFollowers,
  onClickFollowing,
  usernameStyle,
}
