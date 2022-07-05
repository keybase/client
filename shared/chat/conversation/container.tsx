import * as React from 'react'
import * as Constants from '../../constants/chat2'
import * as Types from '../../constants/types/chat2'
import * as Container from '../../util/container'
import Normal from './normal/container'
import NoConversation from './no-conversation'
import Error from './error/container'
import YouAreReset from './you-are-reset'
import Rekey from './rekey/container'
import HeaderArea from './header-area/container'
// @ts-ignore
import {withNavigationFocus} from '@react-navigation/core'

type ConvoType = 'error' | 'noConvo' | 'rekey' | 'youAreReset' | 'normal' | 'rekey'

type SwitchProps = Container.RouteProps<{conversationIDKey: Types.ConversationIDKey}>

let Conversation = (p: SwitchProps) => {
  const conversationIDKey = Container.getRouteProps(p, 'conversationIDKey', Constants.noConversationIDKey)
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))

  let type: ConvoType
  switch (conversationIDKey) {
    case Constants.noConversationIDKey:
      type = 'noConvo'
      break
    default:
      if (meta.membershipType === 'youAreReset') {
        type = 'youAreReset'
      } else if (meta.rekeyers.size > 0) {
        type = 'rekey'
      } else if (meta.trustedState === 'error') {
        type = 'error'
      } else {
        type = 'normal'
      }
  }

  switch (type) {
    case 'error':
      return <Error conversationIDKey={conversationIDKey} />
    case 'noConvo':
      // When navigating back to the inbox on mobile, we deselect
      // conversationIDKey by called mobileChangeSelection. This results in
      // the conversation view rendering "NoConversation" as it is
      // transitioning back the the inbox.
      // On android this is very noticeable because transitions fade between
      // screens, so "NoConversation" will appear on top of the inbox for
      // approximately 150ms.
      // On iOS it is less noticeable because screen transitions slide away to
      // the right, though it is visible for a small amount of time.
      // To solve this we render a blank screen on mobile conversation views with "noConvo"
      return Container.isPhone ? null : <NoConversation />
    case 'normal':
      return <Normal conversationIDKey={conversationIDKey} />
    case 'youAreReset':
      return <YouAreReset />
    case 'rekey':
      return <Rekey conversationIDKey={conversationIDKey} />
    default:
      return <NoConversation />
  }
}

if (Container.isMobile) {
  Conversation = withNavigationFocus(Conversation)
}

// @ts-ignore
Conversation.navigationOptions = {
  header: undefined,
  headerLeft: null,
  headerTitle: () => <HeaderArea />,
}

const ConversationMemoed = React.memo(Conversation)
Container.hoistNonReactStatic(ConversationMemoed, Conversation)

export default ConversationMemoed
