import * as Chat from '@/stores/chat'
import type * as T from '@/constants/types'
import Text from '../text'
import type {StylesTextCrossPlatform} from '../text.shared'

type OwnProps = {
  name: string
  convID: T.Chat.ConversationIDKey
  style: StylesTextCrossPlatform
  allowFontScaling?: boolean
}

const Container = (ownProps: OwnProps) => {
  const {name, convID, style, allowFontScaling} = ownProps
  const previewConversation = Chat.useChatState(s => s.dispatch.previewConversation)
  const onClick = () =>
    previewConversation({
      channelname: name,
      conversationIDKey: convID,
      reason: 'messageLink',
    })

  return (
    <Text type="BodyPrimaryLink" onClick={onClick} style={style} allowFontScaling={!!allowFontScaling}>
      #{name}
    </Text>
  )
}

export default Container
