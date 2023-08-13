import * as C from '../../../../constants'
import type * as Types from '../../../../constants/types/chat2'
import ProfileResetNotice from '.'

export default () => {
  const meta = C.useChatContext(s => s.meta)
  const prevConversationIDKey = meta.supersedes
  const username = meta.wasFinalizedBy || ''
  const _onOpenOlderConversation = (conversationIDKey: Types.ConversationIDKey) => {
    C.getConvoState(conversationIDKey).dispatch.navigateToThread('jumpToReset')
  }
  const props = {
    onOpenOlderConversation: () => {
      prevConversationIDKey && _onOpenOlderConversation(prevConversationIDKey)
    },
    username,
  }
  return <ProfileResetNotice {...props} />
}
