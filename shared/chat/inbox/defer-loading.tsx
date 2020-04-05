import * as React from 'react'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import {HeaderNewChatButton} from './new-chat-button'
import Inbox from './container'

// keep track of this even on unmount, else if you background / foreground you'll lose it
let _everFocused = false

const Deferred = () => {
  _everFocused = _everFocused || Container.useIsFocused()
  const route = Container.useRoute()
  return _everFocused ? <Inbox navKey={route.key} /> : null
}

export default Deferred

export const screenOptions = {
  headerRight: () => <HeaderNewChatButton />,
  headerTitle: () => (
    <Kb.Text type="BodyBig" lineClamp={1}>
      Chats
    </Kb.Text>
  ),
}
