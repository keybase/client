import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import Mention, {type OwnProps} from './mention'
import {useTrackerState} from '@/stores/tracker'
import {useFollowerState} from '@/stores/followers'
import {useCurrentUserState} from '@/stores/current-user'
import {navToProfile} from '@/constants/router'

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

  const showUser = useTrackerState(s => s.dispatch.showUser)
  const _onClick = () => {
    if (C.isMobile) {
      navToProfile(username)
    } else {
      showUser(username, true)
    }
  }
  const onClick = Chat.isSpecialMention(username) ? undefined : _onClick

  const props = {
    allowFontScaling: ownProps.allowFontScaling,
    onClick,
    style: ownProps.style,
    theme,
    username,
  }

  return <Mention {...props} />
}

export default Container
