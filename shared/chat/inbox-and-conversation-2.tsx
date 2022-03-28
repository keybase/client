// Just for desktop and tablet, we show inbox and conversation side by side
import * as Chat2Gen from '../actions/chat2-gen'
import * as Constants from '../constants/chat2'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as React from 'react'
import * as Common from '../router-v2/common'
import Header from './header'
import Conversation from './conversation/container'
import Inbox from './inbox/container'
import InboxSearch from './inbox-search/container'
import InfoPanel from './conversation/info-panel/container'

type Props = {
  navigation?: any
  route: any
}

const InboxAndConversation = (props: Props) => {
  const dispatch = Container.useDispatch()
  const inboxSearch = Container.useSelector(state => state.chat2.inboxSearch)
  const infoPanelShowing = Container.useSelector(state => state.chat2.infoPanelShowing)
  const conversationIDKey = props.route.params?.conversationIDKey
  const validConvoID = conversationIDKey && conversationIDKey !== Constants.noConversationIDKey
  const needSelectConvoID = Container.useSelector(state => {
    if (validConvoID) {
      return null
    }
    const first = state.chat2.inboxLayout?.smallTeams?.[0]
    return first?.convID
  })
  const navKey = props.route.key

  React.useEffect(() => {
    if (needSelectConvoID) {
      // hack to select the convo after we render, TODO move this elsewhere maybe
      setTimeout(() => {
        dispatch(
          Chat2Gen.createNavigateToThread({
            conversationIDKey: needSelectConvoID,
            reason: 'findNewestConversationFromLayout',
          })
        )
      }, 1)
    }
  }, [needSelectConvoID, dispatch])

  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
      {!Container.isTablet && inboxSearch ? (
        <InboxSearch />
      ) : (
        <Inbox navKey={navKey} conversationIDKey={conversationIDKey} />
      )}
      <Conversation navigation={props.navigation} route={props.route} />
      {infoPanelShowing && <InfoPanel conversationIDKey={conversationIDKey} />}
    </Kb.Box2>
  )
}

InboxAndConversation.navigationOptions = ({navigation, route}) => ({
  headerTitle: () => <Header navigation={navigation} route={route} />,
  ...(Styles.isTablet
    ? {
        headerLeft: null,
        headerLeftContainerStyle: {maxWidth: 0},
        headerRight: null,
        headerRightContainerStyle: {maxWidth: 0},
        headerTitleContainerStyle: {
          ...Common.defaultNavigationOptions.headerTitleContainerStyle,
          alignSelf: 'stretch',
          marginHorizontal: 0,
          marginRight: 8,
          maxWidth: 9999,
        },
      }
    : {}),
})

const Memoed = React.memo(InboxAndConversation)
Container.hoistNonReactStatic(Memoed, InboxAndConversation)
export default Memoed
