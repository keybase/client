import * as C from '@/constants'
import type * as T from '@/constants/types'
import {Text} from '@/common-adapters'
import UserNotice from './user-notice'
import {globalColors} from '@/styles'

const SystemProfileResetNotice = () => {
  const meta = C.useChatContext(s => s.meta)
  const prevConversationIDKey = meta.supersedes
  const username = meta.wasFinalizedBy || ''
  const _onOpenOlderConversation = (conversationIDKey: T.Chat.ConversationIDKey) => {
    C.getConvoState(conversationIDKey).dispatch.navigateToThread('jumpToReset')
  }
  const onOpenOlderConversation = () => {
    prevConversationIDKey && _onOpenOlderConversation(prevConversationIDKey)
  }
  return (
    <UserNotice>
      <Text type="BodySmallSemibold" negative={true} style={{color: globalColors.black_50}}>
        {username} reset their profile
      </Text>
      <Text
        type="BodySmallPrimaryLink"
        negative={true}
        style={{color: globalColors.black_50}}
        onClick={onOpenOlderConversation}
      >
        View older conversation
      </Text>
    </UserNotice>
  )
}

export default SystemProfileResetNotice
