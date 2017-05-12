// @flow
import type {UserInfo} from '../constants/tracker'

function followLabel(userInfo: UserInfo, currentlyFollowing: boolean): ?string {
  if (userInfo.followsYou && currentlyFollowing) {
    return 'You follow each other'
  } else if (userInfo.followsYou) {
    return 'Follows you'
  }
  return null
}

export {followLabel}
