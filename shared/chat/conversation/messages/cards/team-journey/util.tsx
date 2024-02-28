import * as React from 'react'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'

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

function computeWelcomeMessageTextRaw(message: T.RPCChat.WelcomeMessage, cannotWrite: boolean): string {
  return computeWelcomeMessageTextHelper(message.set, message.raw, cannotWrite)
}

function computeWelcomeMessageText(message: T.RPCChat.WelcomeMessageDisplay, cannotWrite: boolean): string {
  return computeWelcomeMessageTextHelper(message.set, message.display, cannotWrite)
}

// removeWhitespaceOnlyLines removes lines with only whitespace so the
// lineClamp works properly (otherwise, the lineClamp only applies within
// each "paragraph."
function removeWhitespaceOnlyLines(x: string): string {
  return x.replace(/(^[[\s]*\n)/gm, '')
}

function renderWelcomeMessage(
  message: T.RPCChat.WelcomeMessageDisplay,
  cannotWrite: boolean
): React.ReactNode {
  return (
    <Kb.Markdown
      smallStandaloneEmoji={false}
      lineClamp={3}
      selectable={false}
      paragraphTextClassName="text_BodySmall"
      style={styles.welcomeStyle}
    >
      {removeWhitespaceOnlyLines(computeWelcomeMessageText(message, cannotWrite))}
    </Kb.Markdown>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      welcomeStyle: {
        paddingTop: Kb.Styles.globalMargins.xtiny,
      },
    }) as const
)

export {computeWelcomeMessageTextRaw, renderWelcomeMessage}
