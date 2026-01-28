import * as Chat from '@/stores/chat2'
import type * as T from '@/constants/types'
import Text, {type StylesTextCrossPlatform} from '../text'
import * as React from 'react'

type OwnProps = {
  name: string
  convID: T.Chat.ConversationIDKey
  style: StylesTextCrossPlatform
  allowFontScaling?: boolean
}

const Container = (ownProps: OwnProps) => {
  const {name, convID, style, allowFontScaling} = ownProps
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
    <Text type="BodyPrimaryLink" onClick={onClick} style={style} allowFontScaling={!!allowFontScaling}>
      #{name}
    </Text>
  )
}

export default Container
