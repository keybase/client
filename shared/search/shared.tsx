import * as Types from '../constants/types/search'
import {globalColors} from '../styles'

const followingStateToStyle = (followingState: Types.FollowingState) => {
  return {
    Following: {
      color: globalColors.green,
    },
    NoState: {
      color: globalColors.black,
    },
    NotFollowing: {
      color: globalColors.blue,
    },
    You: {
      color: globalColors.black,
    },
  }[followingState]
}

export {followingStateToStyle}
