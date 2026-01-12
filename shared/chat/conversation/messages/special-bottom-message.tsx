import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as React from 'react'
import OldProfileReset from './system-old-profile-reset-notice/container'
import ResetUser from './reset-user'

const BottomMessageContainer = React.memo(function BottomMessageContainer() {
  const {showSuperseded, showResetParticipants} = Chat.useChatContext(
    C.useShallow(s => {
      const meta = s.meta
      const showResetParticipants = meta.resetParticipants.size !== 0
      const showSuperseded = !!meta.wasFinalizedBy || meta.supersededBy !== Chat.noConversationIDKey
      return {showResetParticipants, showSuperseded}
    })
  )

  if (showResetParticipants) {
    return <ResetUser />
  }
  if (showSuperseded) {
    return <OldProfileReset />
  }
  return null
})
export default BottomMessageContainer
