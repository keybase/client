import * as React from 'react'
import * as Constants from '../../constants/chat2'
import * as Container from '../../util/container'
import Normal from './normal/container'
import NoConversation from './no-conversation'
import Error from './error'
import YouAreReset from './you-are-reset'
import Rekey from './rekey/container'
import {headerNavigationOptions} from './header-area/container'
import type {RouteProps} from '../../router-v2/route-params'

type SwitchProps = RouteProps<'chatConversation'>

const Conversation = (p: SwitchProps) => {
  const conversationIDKey = p.route.params?.conversationIDKey ?? Constants.noConversationIDKey
  const type = Container.useSelector(state => {
    const meta = Constants.getMeta(state, conversationIDKey)
    switch (conversationIDKey) {
      case Constants.noConversationIDKey:
        return 'noConvo'
      default:
        if (meta.membershipType === 'youAreReset') {
          return 'youAreReset'
        } else if (meta.rekeyers.size > 0) {
          return 'rekey'
        } else if (meta.trustedState === 'error') {
          return 'error'
        } else {
          return 'normal'
        }
    }
  })

  switch (type) {
    case 'error':
      return <Error key={conversationIDKey} conversationIDKey={conversationIDKey} />
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
      // the id as key is so we entirely force a top down redraw to ensure nothing is possibly from another convo
      return <Normal key={conversationIDKey} conversationIDKey={conversationIDKey} />
    case 'youAreReset':
      return <YouAreReset />
    case 'rekey':
      return <Rekey key={conversationIDKey} conversationIDKey={conversationIDKey} />
    default:
      return <NoConversation />
  }
}

// @ts-ignore
Conversation.navigationOptions = ({route}) => ({
  ...headerNavigationOptions(route),
  presentation: undefined,
})

const ConversationMemoed = React.memo(Conversation)
Container.hoistNonReactStatic(ConversationMemoed, Conversation)

export default ConversationMemoed
