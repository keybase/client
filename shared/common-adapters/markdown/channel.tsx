import * as Chat from '@/stores/chat2'
import type * as T from '@/constants/types'
import {Text3} from '../text3'
import type {StylesTextCrossPlatform} from '../text3.shared'
import * as React from 'react'

type OwnProps = {
  name: string
  convID: T.Chat.ConversationIDKey
  style: StylesTextCrossPlatform
}

const Container = (ownProps: OwnProps) => {
  const {name, convID, style} = ownProps
  const previewConversation = Chat.useChatState(s => s.dispatch.previewConversation)
  const _onClick = React.useCallback(
    (name: string, convID: T.Chat.ConversationIDKey) =>
      previewConversation({
        channelname: name,
        conversationIDKey: convID,
        reason: 'messageLink',
      }),
    [previewConversation]
  )

  const onClick = () => _onClick(name, convID)

  return (
    <Text3 type="BodyPrimaryLink" onClick={onClick} style={style}>
      #{name}
    </Text3>
  )
}

export default Container
