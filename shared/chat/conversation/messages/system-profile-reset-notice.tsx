import * as C from '@/constants'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import UserNotice from './user-notice'
import {useConversationThreadMeta} from '../thread-context'

const SystemProfileResetNotice = () => {
  const meta = useConversationThreadMeta()
  const prevConversationIDKey = meta.supersedes
  const username = meta.wasFinalizedBy || ''
  const _onOpenOlderConversation = (conversationIDKey: T.Chat.ConversationIDKey) => {
    C.Router2.navigateToThread(conversationIDKey, 'jumpToReset')
  }
  const onOpenOlderConversation = () => {
    if (prevConversationIDKey) {
      _onOpenOlderConversation(prevConversationIDKey)
    }
  }
  return (
    <UserNotice>
      <Kb.Text type="BodySmallSemibold" negative={true} style={{color: Kb.Styles.globalColors.black_50}}>
        {username} reset their profile
      </Kb.Text>
      <Kb.Text
        type="BodySmallPrimaryLink"
        negative={true}
        style={{color: Kb.Styles.globalColors.black_50}}
        onClick={onOpenOlderConversation}
      >
        View older conversation
      </Kb.Text>
    </UserNotice>
  )
}

export default SystemProfileResetNotice
