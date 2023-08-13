import * as C from '../../../../constants'
import * as Constants from '../../../../constants/chat2'
import type * as Types from '../../../../constants/types/chat2'
import OldProfileResetNotice from '.'

export default () => {
  const participantInfo = Constants.useContext(s => s.participants)
  const meta = Constants.useContext(s => s.meta)
  const _participants = participantInfo.all
  const nextConversationIDKey = meta.supersededBy
  const username = meta.wasFinalizedBy || ''
  const onOpenConversation = (conversationIDKey: Types.ConversationIDKey) => {
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
