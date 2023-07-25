// Just for desktop and tablet, we show inbox and conversation side by side
import * as Chat2Gen from '../actions/chat2-gen'
import * as Constants from '../constants/chat2'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as React from 'react'
import type * as Types from '../constants/types/chat2'
import Conversation from './conversation/container'
import Inbox from './inbox/container'
import InboxSearch from './inbox-search/container'
import InfoPanel from './conversation/info-panel/container'

type Props = {conversationIDKey?: Types.ConversationIDKey; navKey?: string}

const InboxAndConversation = React.memo(function InboxAndConversation(props?: Props) {
  const conversationIDKey = props?.conversationIDKey ?? Constants.noConversationIDKey
  const navKey = props?.navKey ?? ''
  const dispatch = Container.useDispatch()
  const inboxSearch = Constants.useState(s => s.inboxSearch)
  const infoPanelShowing = Constants.useState(s => s.infoPanelShowing)
  const validConvoID = conversationIDKey && conversationIDKey !== Constants.noConversationIDKey
  const needSelectConvoID = Constants.useState(s => {
    if (validConvoID) {
      return null
    }
    const first = s.inboxLayout?.smallTeams?.[0]
    return first?.convID
  })

  Container.useOnMountOnce(() => {
    if (needSelectConvoID) {
      // hack to select the convo after we render
      setTimeout(() => {
        dispatch(
          Chat2Gen.createNavigateToThread({
            conversationIDKey: needSelectConvoID,
            reason: 'findNewestConversationFromLayout',
          })
        )
      }, 1)
    }
  })

  return (
    <Kb.KeyboardAvoidingView2>
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true} style={styles.container}>
        {!Container.isTablet && inboxSearch ? (
          <InboxSearch />
        ) : (
          <Inbox navKey={navKey} conversationIDKey={conversationIDKey} />
        )}
        <Kb.Box2 direction="vertical" fullHeight={true} style={styles.conversation}>
          <Conversation conversationIDKey={conversationIDKey} />
        </Kb.Box2>
        {infoPanelShowing ? (
          <Kb.Box2 direction="vertical" fullHeight={true} style={styles.infoPanel}>
            <InfoPanel conversationIDKey={conversationIDKey} />
          </Kb.Box2>
        ) : null}
      </Kb.Box2>
    </Kb.KeyboardAvoidingView2>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {position: 'relative'},
      conversation: {flexGrow: 1},
      infoPanel: {
        backgroundColor: Styles.globalColors.white,
        bottom: 0,
        position: 'absolute',
        right: 0,
        top: 0,
        width: 320,
      },
    }) as const
)

export default InboxAndConversation
