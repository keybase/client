import * as C from '../../../../constants'
import type * as T from '../../../../constants/types'
import OldProfileResetNotice from '.'

export default () => {
  const participantInfo = C.useChatContext(s => s.participants)
  const meta = C.useChatContext(s => s.meta)
  const _participants = participantInfo.all
  const nextConversationIDKey = meta.supersededBy
  const username = meta.wasFinalizedBy || ''
  const onOpenConversation = (conversationIDKey: T.Chat.ConversationIDKey) => {
    C.getConvoState(conversationIDKey).dispatch.navigateToThread('jumpFromReset')
  }
  const previewConversation = C.useChatState(s => s.dispatch.previewConversation)
  const startConversation = (participants: Array<string>) => {
    previewConversation({participants, reason: 'fromAReset'})
  }
  const props = {
    onOpenNewerConversation: nextConversationIDKey
      ? () => onOpenConversation(nextConversationIDKey)
      : () => startConversation(_participants),
    username,
  }
  return <OldProfileResetNotice {...props} />
}
