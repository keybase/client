import * as C from '@/constants'
import Mention, {type OwnProps} from './mention'
import {useTrackerState} from '@/constants/tracker2'
import {useProfileState} from '@/constants/profile'
import {useFollowerState} from '@/constants/followers'

const Container = (ownProps: OwnProps) => {
  let {username} = ownProps
  username = username.toLowerCase()
  const following = useFollowerState(s => s.following.has(username))
  const myUsername = C.useCurrentUserState(s => s.username)
  const theme = (() => {
    if (C.Chat.isSpecialMention(username)) {
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
  const onClick = C.Chat.isSpecialMention(username) ? undefined : _onClick

  const props = {
    onClick,
    theme,
    username,
  }

  return <Mention {...props} />
}

export default Container
