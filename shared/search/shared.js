// @flow
import * as Types from '../constants/types/search'
import {globalColors} from '../styles'

const followingStateToStyle = (followingState: Types.FollowingState) => {
  return {
    Following: {
      color: globalColors.green2,
    },
    NoState: {
      color: globalColors.black_75,
    },
    NotFollowing: {
      color: globalColors.blue,
    },
    You: {
      color: globalColors.black_75,
    },
  }[followingState]
}

export {followingStateToStyle}
