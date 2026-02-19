import * as Chat from '@/stores/chat2'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import UserNotice from './user-notice'

const SystemProfileResetNotice = () => {
  const meta = Chat.useChatContext(s => s.meta)
  const prevConversationIDKey = meta.supersedes
  const username = meta.wasFinalizedBy || ''
  const _onOpenOlderConversation = (conversationIDKey: T.Chat.ConversationIDKey) => {
    Chat.getConvoState(conversationIDKey).dispatch.navigateToThread('jumpToReset')
  }
  const onOpenOlderConversation = () => {
    prevConversationIDKey && _onOpenOlderConversation(prevConversationIDKey)
  }
  return (
    <UserNotice>
      <Kb.Text3 type="BodySmallSemibold" negative={true} style={{color: Kb.Styles.globalColors.black_50}}>
        {username} reset their profile
      </Kb.Text3>
      <Kb.Text3
        type="BodySmallPrimaryLink"
        negative={true}
        style={{color: Kb.Styles.globalColors.black_50}}
        onClick={onOpenOlderConversation}
      >
        View older conversation
      </Kb.Text3>
    </UserNotice>
  )
}

export default SystemProfileResetNotice
