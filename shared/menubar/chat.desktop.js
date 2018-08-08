// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'

const ChatContainer = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.chatContainer}>
    hello
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  chatContainer: Styles.platformStyles({
    isElectron: {
      backgroundColor: Styles.globalColors.white,
      color: Styles.globalColors.black,
    },
  }),
})

export default ChatContainer
