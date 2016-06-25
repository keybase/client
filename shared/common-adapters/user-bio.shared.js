/* @flow */

import keybaseUrl from '../constants/urls'
import openUrl from '../util/open-url'
import {globalColors} from '../styles/style-guide'
import {error as proofError} from '../constants/tracker'

import type {UserInfo} from './user-bio'
import type {SimpleProofState} from '../constants/tracker'

export function onClickAvatar (username: ?string) {
  username && openUrl(`${keybaseUrl}/${username}`)
}

export function onClickFollowers (username: ?string) {
  username && openUrl(`${keybaseUrl}/${username}#profile-tracking-section`)
}

export function onClickFollowing (username: ?string) {
  username && openUrl(`${keybaseUrl}/${username}#profile-tracking-section`)
}

export function followLabel (userInfo: UserInfo, currentlyFollowing: boolean): ?string {
  if (userInfo.followsYou && currentlyFollowing) {
    return 'You track each other'
  } else if (userInfo.followsYou) {
    return 'Tracks you'
  }
  return null
}

export function usernameStyle ({currentlyFollowing, trackerState}: {currentlyFollowing: boolean, trackerState: SimpleProofState}): Object {
  if (trackerState === proofError) {
    return {color: globalColors.red}
  }
  if (currentlyFollowing) {
    return {color: globalColors.green2}
  }
  return {color: globalColors.orange}
}

export function headerColor ({currentlyFollowing, trackerState}: {currentlyFollowing: boolean, trackerState: SimpleProofState}): string {
  if (trackerState === proofError) return globalColors.red
  if (currentlyFollowing) return globalColors.green2
  return globalColors.blue
}
