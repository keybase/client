import * as C from '@/constants'
import type * as T from '@/constants/types'
import {navigateToThread, previewConversation} from '@/constants/router'
import {Text} from '@/common-adapters'
import UserNotice from '../user-notice'
import {useConversationThreadSelector} from '../../thread-context'

const SystemOldProfileResetNotice = () => {
  const {meta, participantInfo} = useConversationThreadSelector(
    C.useShallow(s => ({
      meta: s.meta,
      participantInfo: s.participants,
    }))
  )
  const _participants = participantInfo.all
  const nextConversationIDKey = meta.supersededBy
  const username = meta.wasFinalizedBy || ''
  const onOpenConversation = (conversationIDKey: T.Chat.ConversationIDKey) => {
    navigateToThread(conversationIDKey, 'jumpFromReset')
  }
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
