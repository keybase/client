import type * as T from '@/constants/types'
import {previewConversation} from '@/constants/router'
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
