// @flow
import * as Selectors from '../constants/selectors'
import Mention, {type OwnProps} from './mention'
import {connect, compose, setDisplayName, type TypedState, type Dispatch} from '../util/container'
import {createGetProfile} from '../actions/tracker-gen'
import {isMobile} from '../constants/platform'
import {createShowUserProfile} from '../actions/profile-gen'
import {isSpecialMention} from '../constants/chat2'

const mapStateToProps = (
  state: TypedState,
  {username}: OwnProps
): {theme: $PropertyType<OwnProps, 'theme'>} => {
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

const mapDispatchToProps = (dispatch: Dispatch, {username}: OwnProps) => ({
  onClick: isSpecialMention(username)
    ? undefined
    : () => {
        isMobile
          ? dispatch(createShowUserProfile({username}))
          : dispatch(createGetProfile({username, ignoreCache: true, forceDisplay: true}))
      },
})

export default compose(connect(mapStateToProps, mapDispatchToProps), setDisplayName('Mention'))(Mention)
