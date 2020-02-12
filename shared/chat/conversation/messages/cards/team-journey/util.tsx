import * as React from 'react'
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import * as Styles from '../../../../../styles'
import * as Kb from '../../../../../common-adapters'

// We template these into the input box for the default welcome box, so we can't use Kb.Emoji.
const defaultWelcomeMessageWriter = '👋 Welcome to the team! Say hi to everyone and introduce yourself.'
const defaultWelcomeMessageNonwriter = '👋 Welcome to the team!'

function computeWelcomeMessageText(message: RPCChatTypes.WelcomeMessage, cannotWrite: boolean): string {
  if (message.set) {
    return message.text
  } else if (cannotWrite) {
    return defaultWelcomeMessageNonwriter
  }
  return defaultWelcomeMessageWriter
}

function renderWelcomeMessage(message: RPCChatTypes.WelcomeMessage, cannotWrite: boolean): React.ReactNode {
  return (
    <Kb.Text style={styles.text} type="BodySmall">
      {computeWelcomeMessageText(message, cannotWrite)}
    </Kb.Text>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  text: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-word',
    },
  }),
}))

export {computeWelcomeMessageText, renderWelcomeMessage}
