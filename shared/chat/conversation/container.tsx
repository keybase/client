import * as React from 'react'
import * as Constants from '../../constants/chat2'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Types from '../../constants/types/chat2'
import * as Container from '../../util/container'
import Normal from './normal/container'
import NoConversation from './no-conversation'
import Error from './error/container'
import YouAreReset from './you-are-reset'
import Rekey from './rekey/container'
import HeaderArea from './header-area/container'

type ConvoType = 'error' | 'noConvo' | 'rekey' | 'youAreReset' | 'normal' | 'rekey'

type SwitchProps = {
  conversationIDKey: Types.ConversationIDKey
}

const Conversation = (p: SwitchProps) => {
  const _storeConvoIDKey = Container.useSelector(state => Constants.getSelectedConversation(state))
  const route = Container.useRoute<
    Container.RouteProp<{conversation: {conversationIDKey: Types.ConversationIDKey}}, 'conversation'>
  >()
  const conversationIDKey = Container.isPhone
    ? route.params?.conversationIDKey ?? Constants.noConversationIDKey
    : _storeConvoIDKey

  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))

  let type: ConvoType
  switch (p.conversationIDKey) {
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

  const dispatch = Container.useDispatch()

  const onBack = () => dispatch(RouteTreeGen.createNavigateUp())

  Container.useFocusEffect(
    React.useCallback(() => {
      if (!Container.isMobile) {
        return
      }
      if (_storeConvoIDKey !== conversationIDKey) {
        dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'focused'}))
      }
      return () => {
        if (!Constants.isSplit && _storeConvoIDKey !== conversationIDKey) {
          dispatch(Chat2Gen.createDeselectConversation({ifConversationIDKey: conversationIDKey}))
        }
      }
    }, [dispatch, _storeConvoIDKey, conversationIDKey])
  )

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
      return Container.isMobile ? null : <NoConversation />
    case 'normal':
      return <Normal conversationIDKey={conversationIDKey} />
    case 'youAreReset':
      return <YouAreReset onBack={onBack} />
    case 'rekey':
      return <Rekey conversationIDKey={conversationIDKey} />
    default:
      return <NoConversation onBack={onBack} />
  }
}
Conversation.navigationOptions = {
  header: ({scene}) => (
    <HeaderArea conversationIDKey={scene.route.params.conversationIDKey} progress={scene.progress} />
  ),
}

const ConversationMemoed = React.memo(Conversation)
Container.hoistNonReactStatic(ConversationMemoed, Conversation)

export default ConversationMemoed
