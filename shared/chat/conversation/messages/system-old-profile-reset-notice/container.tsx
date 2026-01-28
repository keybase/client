import * as Chat from '@/stores/chat2'
import type * as T from '@/constants/types'
import {Text} from '@/common-adapters'
import UserNotice from '../user-notice'

const SystemOldProfileResetNotice = () => {
  const participantInfo = Chat.useChatContext(s => s.participants)
  const meta = Chat.useChatContext(s => s.meta)
  const _participants = participantInfo.all
  const nextConversationIDKey = meta.supersededBy
  const username = meta.wasFinalizedBy || ''
  const onOpenConversation = (conversationIDKey: T.Chat.ConversationIDKey) => {
    Chat.getConvoState(conversationIDKey).dispatch.navigateToThread('jumpFromReset')
  }
  const previewConversation = Chat.useChatState(s => s.dispatch.previewConversation)
  const startConversation = (participants: ReadonlyArray<string>) => {
    previewConversation({participants, reason: 'fromAReset'})
  }
  const onOpenNewerConversation = nextConversationIDKey
    ? () => onOpenConversation(nextConversationIDKey)
    : () => startConversation(_participants)

  return (
    <UserNotice>
      <Text type="BodySmallSemibold" negative={true}>
        {username} reset their profile
      </Text>
      <Text type="BodySmall" negative={true}>
        Their encryption keys were replaced with new ones.
      </Text>
      <Text type="BodySmallPrimaryLink" negative={true} onClick={onOpenNewerConversation}>
        Jump to new conversation
      </Text>
    </UserNotice>
  )
}

export default SystemOldProfileResetNotice
