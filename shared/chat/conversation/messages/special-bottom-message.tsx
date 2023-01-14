import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import * as React from 'react'
import OldProfileReset from './system-old-profile-reset-notice/container'
import ResetUser from './reset-user/container'
import {ConvoIDContext} from './ids-context'
import shallowEqual from 'shallowequal'

const BottomMessageContainer = React.memo(function BottomMessageContainer() {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const {showSuperseded, showResetParticipants} = Container.useSelector(state => {
    const meta = Constants.getMeta(state, conversationIDKey)
    const showResetParticipants = meta.resetParticipants.size !== 0
    const showSuperseded = !!meta.wasFinalizedBy || meta.supersededBy !== Constants.noConversationIDKey
    return {showResetParticipants, showSuperseded}
  }, shallowEqual)

  if (showResetParticipants) {
    return <ResetUser conversationIDKey={conversationIDKey} />
  }
  if (showSuperseded) {
    return <OldProfileReset conversationIDKey={conversationIDKey} />
  }
  return null
})
export default BottomMessageContainer
