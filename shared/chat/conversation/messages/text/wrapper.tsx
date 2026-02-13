import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {useReply} from './reply'
import {useBottom} from './bottom'
import {useOrdinal} from '../ids-context'
import {SetRecycleTypeContext} from '../../recycle-type-context'
import {WrapperMessage, useCommonWithData, useMessageData, type Props} from '../wrapper/wrapper'
import type {StyleOverride} from '@/common-adapters/markdown'
import {sharedStyles} from '../shared-styles'
import isEqual from 'lodash/isEqual'

// Encoding all 4 states as static objects so we don't re-render
const getStyle = (
  type: 'error' | 'sent' | 'pending',
  isEditing: boolean,
  isHighlighted?: boolean
): Kb.Styles.StylesCrossPlatform => {
  if (isHighlighted) {
    return Kb.Styles.collapseStyles([sharedStyles.sent, sharedStyles.highlighted])
  } else if (type === 'sent') {
    return isEditing
      ? sharedStyles.sentEditing
      : Kb.Styles.collapseStyles([sharedStyles.sent, {backgroundColor: Kb.Styles.globalColors.fastBlank}])
  } else {
    return isEditing
      ? sharedStyles.pendingFailEditing
      : Kb.Styles.collapseStyles([
          sharedStyles.pendingFail,
          {backgroundColor: Kb.Styles.globalColors.fastBlank},
        ])
  }
}

const MessageMarkdown = React.memo(function MessageMarkdown(p: {style: Kb.Styles.StylesCrossPlatform}) {
  const {style} = p
  const ordinal = useOrdinal()
  const text = Chat.useChatContext(s => {
    const m = s.messageMap.get(ordinal)
    if (m?.type !== 'text') return ''
    const decoratedText = m.decoratedText
    const text = m.text
    return decoratedText ? decoratedText.stringValue() : text.stringValue()
  })

  const styleOverride = React.useMemo(() => (Kb.Styles.isMobile ? {paragraph: style} : undefined), [style])

  return (
    <Kb.Markdown
      messageType="text"
      style={style}
      styleOverride={styleOverride as StyleOverride}
      allowFontScaling={true}
      context={String(ordinal)}
    >
      {text}
    </Kb.Markdown>
  )
})

const WrapperText = React.memo(function WrapperText(p: Props) {
  const {ordinal} = p
  // Fetch message data once and share with both useCommon and WrapperMessage
  const messageData = useMessageData(ordinal)
  const common = useCommonWithData(ordinal, messageData)
  const {type, showCenteredHighlight} = common
  const {isEditing, hasReactions} = messageData

  const bottomChildren = useBottom(ordinal)
  const reply = useReply(ordinal)

  // Get text-specific styling info
  const textType = Chat.useChatContext(s => {
    const m = s.messageMap.get(ordinal)
    const errorReason = m?.errorReason
    return errorReason ? ('error' as const) : !m?.submitState ? ('sent' as const) : ('pending' as const)
  })

  const setRecycleType = React.useContext(SetRecycleTypeContext)

  React.useEffect(() => {
    let subType = ''
    if (reply) {
      subType += ':reply'
    }
    if (hasReactions) {
      subType += ':reactions'
    }
    if (subType.length) {
      setRecycleType(ordinal, 'text' + subType)
    }
  }, [ordinal, reply, hasReactions, setRecycleType])

  // Uncomment to test effective recycling
  // const DEBUGOldOrdinalRef = React.useRef(0)
  // const DEBUGOldTypeRef = React.useRef('')
  // React.useEffect(() => {
  //   const oldtype = DEBUGOldTypeRef.current
  //   if (DEBUGOldOrdinalRef.current) {
  //     console.log(
  //       'debug textwrapperRecycle',
  //       DEBUGOldOrdinalRef.current,
  //       ordinal,
  //       subType === oldtype ? `SAME ${subType}` : `${subType} != ${oldtype} <<<<<<<<<<<<<<<<<`
  //     )
  //   }
  //   DEBUGOldOrdinalRef.current = ordinal
  //   DEBUGOldTypeRef.current = subType
  // }, [ordinal, subType])

  const [style, setStyle] = React.useState<Kb.Styles.StylesCrossPlatform>(
    getStyle(textType, isEditing, showCenteredHighlight)
  )

  React.useEffect(() => {
    const s = getStyle(textType, isEditing, showCenteredHighlight)
    setStyle(old => (isEqual(s, old) ? old : s))
  }, [textType, isEditing, showCenteredHighlight])

  const children = React.useMemo(() => {
    return (
      <>
        {reply}
        <MessageMarkdown style={style} />
      </>
    )
  }, [reply, style])

  // due to recycling, we can have items that aren't connected to the list that might have live connectors
  // so when we load more etc the entire messagMap could no longer have your item
  if (type !== 'text') {
    return null
  }

  return (
    <WrapperMessage {...p} {...common} bottomChildren={bottomChildren} messageData={messageData}>
      {children}
    </WrapperMessage>
  )
})

export default WrapperText
