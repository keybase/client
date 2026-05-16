import * as Chat from '@/constants/chat'
import {useConversationThreadSelector} from '@/chat/conversation/thread-context'
import OldProfileReset from '@/chat/conversation/messages/system-old-profile-reset-notice/container'
import ResetUser from '@/chat/conversation/messages/reset-user'

function BottomMessageContainer() {
  const meta = useConversationThreadSelector(s => s.meta)
  const showResetParticipants = meta.resetParticipants.size !== 0
  const showSuperseded = !!meta.wasFinalizedBy || meta.supersededBy !== Chat.noConversationIDKey

  if (showResetParticipants) {
    return <ResetUser />
  }
  if (showSuperseded) {
    return <OldProfileReset />
  }
  return null
}
export default BottomMessageContainer
