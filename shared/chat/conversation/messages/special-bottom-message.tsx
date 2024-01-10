import * as C from '@/constants'
import * as React from 'react'
import OldProfileReset from './system-old-profile-reset-notice/container'
import ResetUser from './reset-user/container'

const BottomMessageContainer = React.memo(function BottomMessageContainer() {
  const {showSuperseded, showResetParticipants} = C.useChatContext(
    C.useShallow(s => {
      const meta = s.meta
      const showResetParticipants = meta.resetParticipants.size !== 0
      const showSuperseded = !!meta.wasFinalizedBy || meta.supersededBy !== C.Chat.noConversationIDKey
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
