import * as C from '../../../constants'
import * as React from 'react'
import OldProfileReset from './system-old-profile-reset-notice/container'
import ResetUser from './reset-user/container'
import shallowEqual from 'shallowequal'

const BottomMessageContainer = React.memo(function BottomMessageContainer() {
  const {showSuperseded, showResetParticipants} = C.useChatContext(s => {
    const meta = s.meta
    const showResetParticipants = meta.resetParticipants.size !== 0
    const showSuperseded = !!meta.wasFinalizedBy || meta.supersededBy !== C.noConversationIDKey
    return {showResetParticipants, showSuperseded}
  }, shallowEqual)

  if (showResetParticipants) {
    return <ResetUser />
  }
  if (showSuperseded) {
    return <OldProfileReset />
  }
  return null
})
export default BottomMessageContainer
