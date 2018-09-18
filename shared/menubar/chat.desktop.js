// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as ChatTypes from '../constants/types/chat2'
import * as SmallTeam from '../chat/inbox/row/small-team'
import * as RemoteContainer from '../chat/inbox/container/remote'

const ChatViewAll = ({onViewAll}: {onViewAll: () => void}) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true}>
    <Kb.ClickableBox onClick={onViewAll} className="toggleButtonClass" style={styles.toggleButton}>
      <Kb.Text type="BodySmallSemibold" style={styles.buttonText}>
        View all
      </Kb.Text>
    </Kb.ClickableBox>
  </Kb.Box2>
)

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
      return (
        <SmallTeam.SmallTeam key={r.conversationIDKey} {...r} />
      )
    })}
    <ChatViewAll onViewAll={onViewAll} />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  buttonText: {color: Styles.globalColors.black_60},
  chatContainer: {
    backgroundColor: Styles.globalColors.white,
    color: Styles.globalColors.black,
  },
  toggleButton: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.black_05,
      borderRadius: 19,
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
