import * as Types from '../constants/types/search'
import * as Styles from '../styles'

const followingStateToStyle = (followingState: Types.FollowingState) => {
  return {
    Following: {
      color: Styles.globalColors.greenDark,
    },
    NoState: {
      color: Styles.globalColors.black,
    },
    NotFollowing: {
      color: Styles.globalColors.blueDark,
    },
    You: {
      color: Styles.globalColors.black,
    },
  }[followingState]
}

export {followingStateToStyle}
