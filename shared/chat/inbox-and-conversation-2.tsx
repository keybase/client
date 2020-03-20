// Just for desktop and tablet, we show inbox and conversation side by side
import * as React from 'react'
import * as Kb from '../common-adapters'
import Inbox from './inbox/container'
import InboxSearch from './inbox-search/container'
import Conversation from './conversation/container'
import Header from './header'
import InfoPanel from './conversation/info-panel/container'
import * as Chat2Gen from '../actions/chat2-gen'
import * as Constants from '../constants/chat2'
import * as Container from '../util/container'
import {withNavigation} from '@react-navigation/core'

type Props = {
  navigation?: any
}

const InboxAndConversation = (props: Props) => {
  const dispatch = Container.useDispatch()
  const inboxSearch = Container.useSelector(state => state.chat2.inboxSearch)
  const infoPanelShowing = Container.useSelector(state => state.chat2.infoPanelShowing)
  const conversationIDKey = props.navigation.state?.params?.conversationIDKey
  const validConvoID = conversationIDKey && conversationIDKey !== Constants.noConversationIDKey
  const needSelectConvoID = Container.useSelector(state => {
    if (validConvoID) {
      return null
    }
    const first = state.chat2.inboxLayout?.smallTeams?.[0]
    return first?.convID
  })
  const navKey = props.navigation.state.key

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
      {!Container.isTablet && inboxSearch ? (
        <InboxSearch />
      ) : (
        <Inbox navKey={navKey} conversationIDKey={conversationIDKey} />
      )}
      <Conversation navigation={props.navigation} />
      {infoPanelShowing && <InfoPanel conversationIDKey={conversationIDKey} />}
    </Kb.Box2>
  )
}

InboxAndConversation.navigationOptions = {
  header: undefined,
  headerTitle: withNavigation(Header),
  headerTitleContainerStyle: {left: 0, right: 0},
}

const Memoed = React.memo(InboxAndConversation)
Container.hoistNonReactStatic(Memoed, InboxAndConversation)
export default Memoed
