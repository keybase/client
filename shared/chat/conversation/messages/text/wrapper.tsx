import * as Kb from '@/common-adapters'
import * as React from 'react'
import {useReply} from './reply'
import {useBottom} from './bottom'
import {useOrdinal} from '../ids-context'
import {SetRecycleTypeContext} from '../../recycle-type-context'
import {WrapperMessageView, useCommonWithData, useMessageData, type Props} from '../wrapper/wrapper'
import type {StyleOverride} from '@/common-adapters/markdown'
import {sharedStyles} from '../shared-styles'

let _sentHighlighted: Kb.Styles.StylesCrossPlatform | undefined
const getSentHighlighted = () => {
  _sentHighlighted ??= Kb.Styles.collapseStyles([sharedStyles.sent, sharedStyles.highlighted])
  return _sentHighlighted
}

const getStyle = (
  type: 'error' | 'sent' | 'pending',
  isEditing: boolean,
  isHighlighted?: boolean
): Kb.Styles.StylesCrossPlatform => {
  if (isHighlighted) {
    return getSentHighlighted()
  } else if (type === 'sent') {
    return isEditing ? sharedStyles.sentEditing : sharedStyles.sent
  } else {
    return isEditing ? sharedStyles.pendingFailEditing : sharedStyles.pendingFail
  }
}

function MessageMarkdown({style, text}: {style: Kb.Styles.StylesCrossPlatform; text: string}) {
  const ordinal = useOrdinal()
  const styleOverride = Kb.Styles.isMobile ? {paragraph: style} : undefined

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
}

function WrapperText(p: Props) {
  const {ordinal, isCenteredHighlight = false} = p
  const messageData = useMessageData(ordinal, isCenteredHighlight)
  const common = useCommonWithData(ordinal, messageData)
  const {type, showCenteredHighlight} = common
  const {isEditing, hasReactions} = messageData

  const {hasCoinFlip, hasUnfurlList, hasUnfurlPrompts, textType, showReplyTo, text} = messageData
  const bottomChildren = useBottom({hasCoinFlip, hasUnfurlList, hasUnfurlPrompts})
  const reply = useReply(showReplyTo)

  const setRecycleType = React.useContext(SetRecycleTypeContext)

  React.useEffect(() => {
    let subType = ''
    if (showReplyTo) {
      subType += ':reply'
    }
    if (hasReactions) {
      subType += ':reactions'
    }
    if (subType.length) {
      setRecycleType(ordinal, 'text' + subType)
    }
  }, [ordinal, showReplyTo, hasReactions, setRecycleType])

  const style = getStyle(textType, isEditing, showCenteredHighlight)

  const children = (
    <>
      {reply}
      <MessageMarkdown style={style} text={text} />
    </>
  )

  // due to recycling, we can have items that aren't connected to the list that might have live connectors
  // so when we load more etc the entire messagMap could no longer have your item
  if (type !== 'text') {
    return null
  }

  return (
    <WrapperMessageView {...p} {...common} bottomChildren={bottomChildren} messageData={messageData}>
      {children}
    </WrapperMessageView>
  )
}

export default WrapperText
