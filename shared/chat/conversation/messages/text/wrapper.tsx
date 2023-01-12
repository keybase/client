import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../styles'
import {useClaim} from './claim'
import {useReply} from './reply'
import {useBottom} from './bottom'
import {ConvoIDContext, OrdinalContext} from '../ids-context'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import {sharedStyles} from '../shared-styles'
import shallowEqual from 'shallowequal'

// Encoding all 4 states as static objects so we don't re-render
const getStyle = (
  type: 'error' | 'sent' | 'pending',
  isEditing: boolean,
  isHighlighted?: boolean
): Styles.StylesCrossPlatform => {
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

const MessageMarkdown = (p: {style: Styles.StylesCrossPlatform}) => {
  const {style} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const text = Container.useSelector(state => {
    const m = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    if (m?.type !== 'text') return ''
    const decoratedText = m.decoratedText
    const text = m.text
    return decoratedText ? decoratedText.stringValue() : text ? text.stringValue() : ''
  })

  const styleOverride = React.useMemo(
    () => (Styles.isMobile ? ({paragraph: style} as any) : undefined),
    [style]
  )

  return (
    <Kb.Markdown messageType="text" style={style} styleOverride={styleOverride} allowFontScaling={true}>
      {text}
    </Kb.Markdown>
  )
}

const WrapperText = React.memo(function WrapperText(p: Props) {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const {ordinal} = p
  const common = useCommon(ordinal)
  const {showCenteredHighlight, toggleShowingPopup} = common

  const bottomChildren = useBottom(ordinal, showCenteredHighlight, toggleShowingPopup)
  const reply = useReply(ordinal, showCenteredHighlight)
  const claim = useClaim(ordinal)

  const {isEditing, type} = Container.useSelector(state => {
    const editInfo = Constants.getEditInfo(state, conversationIDKey)
    const isEditing = !!(editInfo && editInfo.ordinal === ordinal)
    const m = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    const errorReason = m?.errorReason
    const type = errorReason ? ('error' as const) : !m?.submitState ? ('sent' as const) : ('pending' as const)
    return {isEditing, type}
  }, shallowEqual)

  const style = React.useMemo(
    () => getStyle(type, isEditing, showCenteredHighlight),
    [type, isEditing, showCenteredHighlight]
  )

  const children = React.useMemo(() => {
    return (
      <>
        {reply}
        <MessageMarkdown style={style} />
        {claim}
      </>
    )
  }, [reply, claim, style])

  return (
    <WrapperMessage {...p} {...common} bottomChildren={bottomChildren}>
      {children}
    </WrapperMessage>
  )
})

export default WrapperText
