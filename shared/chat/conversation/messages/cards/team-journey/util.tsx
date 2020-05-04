import * as React from 'react'
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'

const defaultWelcomeMessageWriter = ':wave: Welcome to the team! Say hi to everyone and introduce yourself.'
const defaultWelcomeMessageNonwriter = ':wave: Welcome to the team!'

function computeWelcomeMessageTextHelper(set: boolean, text: string, cannotWrite: boolean): string {
  if (set) {
    return text
  } else if (cannotWrite) {
    return defaultWelcomeMessageNonwriter
  }
  return defaultWelcomeMessageWriter
}

function computeWelcomeMessageTextRaw(message: RPCChatTypes.WelcomeMessage, cannotWrite: boolean): string {
  return computeWelcomeMessageTextHelper(message.set, message.raw, cannotWrite)
}

function computeWelcomeMessageText(
  message: RPCChatTypes.WelcomeMessageDisplay,
  cannotWrite: boolean
): string {
  return computeWelcomeMessageTextHelper(message.set, message.display, cannotWrite)
}

// removeWhitespaceOnlyLines removes lines with only whitespace so the
// lineClamp works properly (otherwise, the lineClamp only applies within
// each "paragraph."
function removeWhitespaceOnlyLines(x: string): string {
  return x.replace(/(^[[\s]*\n)/gm, '')
}

function renderWelcomeMessage(
  message: RPCChatTypes.WelcomeMessageDisplay,
  cannotWrite: boolean
): React.ReactNode {
  return (
    <Kb.Markdown smallStandaloneEmoji={false} lineClamp={3} selectable={false} paragraphTextClassName="text_BodySmall" style={welcomeStyle}>
      {removeWhitespaceOnlyLines(computeWelcomeMessageText(message, cannotWrite))}
    </Kb.Markdown>
  )
}

const welcomeStyle = {
	paddingTop: Styles.globalMargins.xtiny,
}

export {computeWelcomeMessageText, computeWelcomeMessageTextRaw, renderWelcomeMessage}
