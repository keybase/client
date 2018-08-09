// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'

const ChatRow = (props: ChatRowProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.chatRowContainer}>
    <Kb.Text type="BodySmallSemibold" style={styles.conversationName}>
      {props.teamname ? `${props.teamname}#${props.channelname}` : props.participants[0]}:
    </Kb.Text>
    <Kb.Text type="BodySmall">
      {props.snippet}
    </Kb.Text>
  </Kb.Box2>
)

const ChatViewAll = ({onViewAll}: {onViewAll: () => void}) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true}>
    <Kb.ClickableBox onClick={onViewAll} className="toggleButtonClass" style={styles.toggleButton}>
      <Kb.Text type="BodySmallSemibold" style={styles.buttonText}>
        View all
      </Kb.Text>
    </Kb.ClickableBox>
  </Kb.Box2>
)

export type ChatRowProps = {
  conversationIDKey: string,
  snippet: string,
  participants: Array<string>,
  channelname: string,
  teamname: string,
}

export type ChatContainerProps = {
  onViewAll: () => void,
  conversations: Array<ChatRowProps>,
}

export const ChatContainer = ({onViewAll, conversations}: ChatContainerProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.chatContainer}>
    {conversations.slice(0, 3).map(c => (
      <ChatRow key={c.conversationIDKey} {...c} />
    ))}
    <ChatViewAll onViewAll={onViewAll} />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  chatContainer: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      color: Styles.globalColors.black,
    },
  }),
  chatRowContainer: Styles.platformStyles({
    common: {
      height: 56,
      overflow: 'hidden',
    },
    isElectron: {
      textOverflow: 'ellipsis',
    },
  }),
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
  buttonText: {color: Styles.globalColors.black_60},
  conversationName: Styles.platformStyles({
    common: {
      marginRight: Styles.globalMargins.xtiny,
    },
  }),
})
