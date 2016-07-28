/* @flow */

import keybaseUrl from '../constants/urls'
import openUrl from '../util/open-url'

import type {UserInfo} from './user-bio'

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
    return 'You follow each other'
  } else if (userInfo.followsYou) {
    return 'Follows you'
  }
  return null
}

