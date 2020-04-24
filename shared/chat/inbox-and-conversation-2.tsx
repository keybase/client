// Just for desktop and tablet, we show inbox and conversation side by side
import * as React from 'react'
import * as Kb from '../common-adapters'
import Inbox from './inbox/container'
import InboxSearch from './inbox-search/container'
import Conversation from './conversation/container'
import InfoPanel from './conversation/info-panel/container'
import * as Chat2Gen from '../actions/chat2-gen'
import * as Types from '../constants/types/chat2'
import * as Constants from '../constants/chat2'
import * as Container from '../util/container'

type Props = {
  conversationIDKey: Types.ConversationIDKey
}

const InboxAndConversation = (props: Props) => {
  const {conversationIDKey} = props
  const dispatch = Container.useDispatch()
  const inboxSearch = Container.useSelector(state => state.chat2.inboxSearch)
  const infoPanelShowing = Container.useSelector(state => state.chat2.infoPanelShowing)
  const validConvoID = conversationIDKey && conversationIDKey !== Constants.noConversationIDKey
  const needSelectConvoID = Container.useSelector(state => {
    if (validConvoID) {
      return null
    }
    const first = state.chat2.inboxLayout?.smallTeams?.[0]
    return first?.convID
  })

  React.useEffect(() => {
    if (needSelectConvoID) {
      dispatch(
        Chat2Gen.createNavigateToThread({
          conversationIDKey: needSelectConvoID,
          reason: 'findNewestConversationFromLayout',
        })
      )
    }
  }, [needSelectConvoID, dispatch])

  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
      {!Container.isTablet && inboxSearch ? <InboxSearch /> : <Inbox conversationIDKey={conversationIDKey} />}
      <Conversation conversationIDKey={conversationIDKey} />
      {infoPanelShowing && <InfoPanel conversationIDKey={conversationIDKey} />}
    </Kb.Box2>
  )
}

const Memoed = React.memo(InboxAndConversation)
Container.hoistNonReactStatic(Memoed, InboxAndConversation)
export default Memoed
