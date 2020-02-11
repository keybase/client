import * as React from 'react'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as Styles from '../styles'
import * as Kb from '../common-adapters'

function renderWelcomeMessage(message: RPCChatTypes.WelcomeMessage, cannotWrite: boolean): React.ReactNode {
  if (message.set) {
    return <Kb.Text type="BodySmall">{message.text}</Kb.Text>
  } else if (cannotWrite) {
    return (
      <Kb.Text type="BodySmall" style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
        <Kb.Emoji allowFontScaling={true} size={Styles.globalMargins.small} emojiName=":wave:" /> Welcome to
        the team!
      </Kb.Text>
    )
  } else {
    return (
      <Kb.Text type="BodySmall">
        <Kb.Emoji allowFontScaling={true} size={Styles.globalMargins.small} emojiName=":wave:" /> Welcome to
        the team! Say hi to everyone and introduce yourself.
      </Kb.Text>
    )
  }
}

export {renderWelcomeMessage}
