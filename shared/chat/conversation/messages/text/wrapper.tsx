import * as Kb from '@/common-adapters'
import {useReply} from '@/chat/conversation/messages/text/reply'
import {useBottom} from '@/chat/conversation/messages/text/bottom'
import {useOrdinal} from '@/chat/conversation/messages/ids-context'
import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '@/chat/conversation/messages/wrapper/wrapper'
import type {StyleOverride} from '@/common-adapters/markdown'
import {sharedStyles} from '@/chat/conversation/messages/shared-styles'
import {useConversationCenter} from '@/chat/conversation/center-context'

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
  const styleOverride = Kb.Styles.isMobile ? ({paragraph: style} as StyleOverride) : undefined

  return (
    <Kb.Markdown
      messageType="text"
      style={style}
      styleOverride={styleOverride}
      allowFontScaling={true}
      context={String(ordinal)}
    >
      {text}
    </Kb.Markdown>
  )
}

function WrapperText(p: Props) {
  const {ordinal, isCenteredHighlight = false} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {messageData} = wrapper
  const {centerOnMessage} = useConversationCenter()
  const {isEditing, message, replyTo} = messageData

  const {hasCoinFlip, hasUnfurlList, hasUnfurlPrompts, showCenteredHighlight, text, textType, type} =
    messageData
  const bottomChildren = useBottom({
    author: message.author,
    conversationIDKey: message.conversationIDKey,
    hasCoinFlip,
    hasUnfurlList,
    hasUnfurlPrompts,
    messageID: message.id,
    unfurls: message.type === 'text' ? message.unfurls : undefined,
  })
  const onReplyClick = () => {
    const id = replyTo?.id ?? 0
    if (id) {
      centerOnMessage(id, 'flash')
    }
  }
  const reply = useReply(replyTo, onReplyClick)

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
    <WrapperMessage {...p} {...wrapper} bottomChildren={bottomChildren}>
      {children}
    </WrapperMessage>
  )
}

export default WrapperText
