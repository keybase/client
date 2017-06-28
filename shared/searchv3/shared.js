// @flow
import * as Constants from '../constants/searchv3'
import {globalColors} from '../styles'

const followingStateToStyle = (followingState: Constants.FollowingState) => {
  return {
    Following: {
      color: globalColors.green2,
    },
    NoState: {
      color: globalColors.black_40,
    },
    NotFollowing: {
      color: globalColors.blue,
    },
    You: {
      fontStyle: 'italic',
      color: globalColors.black,
    },
  }[followingState]
}

export {followingStateToStyle}
