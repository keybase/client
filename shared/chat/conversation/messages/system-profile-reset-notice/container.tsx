import * as C from '@/constants'
import type * as T from '@/constants/types'
import ProfileResetNotice from '.'

const Container = () => {
  const meta = C.useChatContext(s => s.meta)
  const prevConversationIDKey = meta.supersedes
  const username = meta.wasFinalizedBy || ''
  const _onOpenOlderConversation = (conversationIDKey: T.Chat.ConversationIDKey) => {
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
export default Container
