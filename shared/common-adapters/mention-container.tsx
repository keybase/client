import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import Mention, {type OwnProps} from './mention'
import {useTrackerState} from '@/stores/tracker2'
import {useProfileState} from '@/stores/profile'
import {useFollowerState} from '@/stores/followers'
import {useCurrentUserState} from '@/stores/current-user'

const Container = (ownProps: OwnProps) => {
  let {username} = ownProps
  username = username.toLowerCase()
  const following = useFollowerState(s => s.following.has(username))
  const myUsername = useCurrentUserState(s => s.username)
  const theme = (() => {
    if (Chat.isSpecialMention(username)) {
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

  const showUserProfile = useProfileState(s => s.dispatch.showUserProfile)
  const showUser = useTrackerState(s => s.dispatch.showUser)
  const _onClick = () => {
    if (C.isMobile) {
      showUserProfile(username)
    } else {
      showUser(username, true)
    }
  }
  const onClick = Chat.isSpecialMention(username) ? undefined : _onClick

  const props = {
    onClick,
    theme,
    username,
  }

  return <Mention {...props} />
}

export default Container
