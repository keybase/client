import * as C from '../constants'
import Mention, {type OwnProps} from './mention'
import {isSpecialMention} from '../constants/chat2'
import * as Container from '../util/container'

export default (ownProps: OwnProps) => {
  let {username} = ownProps
  username = username.toLowerCase()
  const following = C.useFollowerState(s => s.following.has(username))
  const myUsername = C.useCurrentUserState(s => s.username)
  const theme = (() => {
    if (isSpecialMention(username)) {
      return 'highlight' as const
    } else {
      if (myUsername === username) {
        return 'highlight' as const
      } else if (following) {
        return 'follow' as const
      }
      return 'nonFollow' as const
    }
  })()

  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const showUser = C.useTrackerState(s => s.dispatch.showUser)
  const _onClick = () => {
    if (Container.isMobile) {
      showUserProfile(username)
    } else {
      showUser(username, true)
    }
  }
  const onClick = isSpecialMention(username) ? undefined : _onClick

  const props = {
    onClick,
    theme,
    username,
  }

  return <Mention {...props} />
}
