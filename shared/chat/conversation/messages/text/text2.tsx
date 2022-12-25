import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import type * as Types from '../../../../constants/types/chat2'
import {sharedStyles} from '../shared-styles'

type Props = {
  ordinal: Types.Ordinal
  conversationIDKey: Types.ConversationIDKey
  previous?: Types.Ordinal
}
export const Text2 = React.memo(function Text2(_: Props) {

const MessageText = ({claim, isEditing, isHighlighted, message, reply, text, type}: Props) => {
  // const wrappedMeta = useMemo(() => ({message}), [message])
  const styleOverride = React.useMemo(
    () => (Styles.isMobile ? {paragraph: getStyle(type, isEditing, isHighlighted)} : undefined),
    [type, isEditing, isHighlighted]
  )
  const markdown = (
  )

    return <Kb.Box2 direction="vertical" style={styles.wrapper} fullWidth={true}>
    <Kb.Markdown
      style={getStyle(type, isEditing, isHighlighted)}
      meta={wrappedMeta}
      styleOverride={styleOverride}
      allowFontScaling={true}
    >
      {text}
    </Kb.Markdown>
    </Kb.Box2>
})

// Encoding all 4 states as static objects so we don't re-render
const getStyle = (type: Props['type'], isEditing: boolean, isHighlighted?: boolean) => {
  if (isHighlighted) {
    return Styles.collapseStyles([sharedStyles.sent, sharedStyles.highlighted])
  } else if (type === 'sent') {
    return isEditing
      ? sharedStyles.sentEditing
      : Styles.collapseStyles([sharedStyles.sent, Styles.globalStyles.fastBackground])
  } else {
    return isEditing
      ? sharedStyles.pendingFailEditing
      : Styles.collapseStyles([sharedStyles.pendingFail, Styles.globalStyles.fastBackground])
  }
}
