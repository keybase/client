import * as ProfileGen from '../actions/profile-gen'
import * as Tracker2Gen from '../actions/tracker2-gen'
import Mention, {OwnProps} from './mention'
import {isSpecialMention} from '../constants/chat2'
import * as Container from '../util/container'

export default Container.namedConnect(
  (state, {username}: OwnProps) => {
    if (isSpecialMention(username)) {
      return {theme: 'highlight' as const}
    }

    if (state.config.username === username) {
      return {theme: 'highlight' as const}
    }

    if (state.config.following.has(username)) {
      return {theme: 'follow' as const}
    }

    return {theme: 'nonFollow' as const}
  },
  (dispatch, {username}: OwnProps) => ({
    onClick: isSpecialMention(username)
      ? undefined
      : () => {
          if (Container.isMobile) {
            dispatch(ProfileGen.createShowUserProfile({username}))
          } else {
            dispatch(Tracker2Gen.createShowUser({asTracker: true, username}))
          }
        },
  }),

  (s, d, o: OwnProps) => ({...o, ...s, ...d}),
  'Mention'
)(Mention)
