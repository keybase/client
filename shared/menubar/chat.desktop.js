// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as ChatTypes from '../constants/types/chat2'
import * as SmallTeam from '../chat/inbox/row/small-team'
import * as RemoteContainer from '../chat/inbox/container/remote'

type ConvRow = {|
  ...$Exact<RemoteContainer.RemoteConvMeta>,
  conversationIDKey: ChatTypes.ConversationIDKey,
  onSelectConversation: () => void,
|}

type ChatPreviewProps = {
  onViewAll: () => void,
  convRows: Array<ConvRow>,
}

export const ChatPreview = ({onViewAll, onSelectConversation, convRows}: ChatPreviewProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.chatContainer}>
    {convRows.map(r => {
      return <SmallTeam.SmallTeam key={r.conversationIDKey} {...r} />
    })}
    <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.buttonContainer}>
      <Kb.Button label="View all" onClick={onViewAll} small={true} type="Secondary" />
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  buttonContainer: {
    marginTop: Styles.globalMargins.tiny,
  },
  chatContainer: {
    backgroundColor: Styles.globalColors.white,
    color: Styles.globalColors.black,
  },
  toggleButton: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.black_05,
      borderRadius: Styles.borderRadius,
      marginBottom: Styles.globalMargins.xtiny,
      marginTop: Styles.globalMargins.xtiny,
      paddingBottom: Styles.globalMargins.xtiny,
      paddingTop: Styles.globalMargins.xtiny,
    },
    isElectron: {
      marginLeft: Styles.globalMargins.tiny,
      marginRight: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
})
