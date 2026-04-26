import * as Chat from '@/stores/chat'
import Mention, {type OwnProps} from './mention'
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

  const _onClick = () => navToProfile(username)
  const onClick = Chat.isSpecialMention(username) ? undefined : _onClick

  const props = {
    theme,
    username,
    ...(ownProps.allowFontScaling === undefined ? {} : {allowFontScaling: ownProps.allowFontScaling}),
    ...(onClick === undefined ? {} : {onClick}),
    ...(ownProps.style === undefined ? {} : {style: ownProps.style}),
  }

  return <Mention {...props} />
}

export default Container
