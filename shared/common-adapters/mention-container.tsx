import * as Selectors from '../constants/selectors'
import * as ProfileGen from '../actions/profile-gen'
import * as Tracker2Gen from '../actions/tracker2-gen'
import Mention, {OwnProps} from './mention'
import {isMobile} from '../constants/platform'
import {isSpecialMention} from '../constants/chat2'
import {namedConnect} from '../util/container'

const mapStateToProps = (
  state,
  {username}: OwnProps
): {
  theme: OwnProps['theme']
} => {
  if (isSpecialMention(username)) {
    return {theme: 'highlight'}
  }

  if (state.config.username === username) {
    return {theme: 'highlight'}
  }

  if (Selectors.amIFollowing(state, username)) {
    return {theme: 'follow'}
  }

  return {theme: 'nonFollow'}
}

const mapDispatchToProps = (dispatch, {username}: OwnProps) => ({
  onClick: isSpecialMention(username)
    ? undefined
    : () => {
        if (isMobile) {
          dispatch(ProfileGen.createShowUserProfile({username}))
        } else {
          dispatch(Tracker2Gen.createShowUser({asTracker: true, username}))
        }
      },
})

export default namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'Mention'
)(Mention)
