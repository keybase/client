// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'

const ChatRow = ({name}: {name: string}) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.chatRowContainer}>
    {name}
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

type ChatContainerProps = {
  onViewAll: () => void,
  convIDs: Array<string>,
}

const ChatContainer = ({onViewAll, convIDs}: ChatContainerProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.chatContainer}>
    {convIDs.slice(0, 3).map(id => (
      <ChatRow key={id} name={id.substr(0, 30)} />
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
      minHeight: 56,
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
})

export default ChatContainer
