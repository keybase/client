import * as Chat from '@/constants/chat'
import {useConversationThreadMeta} from '../thread-context'
import OldProfileReset from './system-old-profile-reset-notice/container'
import ResetUser from './reset-user'

function BottomMessageContainer() {
  const meta = useConversationThreadMeta()
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
