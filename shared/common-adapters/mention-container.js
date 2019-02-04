// @flow
import * as Selectors from '../constants/selectors'
import Mention, {type OwnProps} from './mention'
import {namedConnect} from '../util/container'
import {createGetProfile} from '../actions/tracker-gen'
import {isMobile} from '../constants/platform'
import {createShowUserProfile} from '../actions/profile-gen'
import {isSpecialMention} from '../constants/chat2'

const mapStateToProps = (state, {username}: OwnProps): {|theme: $PropertyType<OwnProps, 'theme'>|} => {
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
          dispatch(createShowUserProfile({username}))
        } else {
          dispatch(createGetProfile({forceDisplay: true, ignoreCache: true, username}))
        }
      },
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'Mention'
)(Mention)
