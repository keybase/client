import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import Normal from './normal2'
import Preview from './preview'
import ThreadSearch from '../search'

const InputAreaContainer = () => {
  const conversationIDKey = Chat.useChatContext(s => s.id)
  const showThreadSearch = Chat.useChatContext(s => s.threadSearchInfo.visible)
  const {membershipType, resetParticipants, wasFinalizedBy} = Chat.useChatContext(
    C.useShallow(s => {
      const {membershipType, resetParticipants, wasFinalizedBy} = s.meta
      return {membershipType, resetParticipants, wasFinalizedBy}
    })
  )

  let noInput = resetParticipants.size > 0 || !!wasFinalizedBy
  if (
    conversationIDKey === Chat.pendingWaitingConversationIDKey ||
    conversationIDKey === Chat.pendingErrorConversationIDKey
  ) {
    noInput = true
  }

  const isPreview = membershipType === 'youArePreviewing'

  if (noInput) {
    return null
  }
  if (isPreview) {
    return <Preview />
  }
  if (showThreadSearch && C.isMobile) {
    return <ThreadSearch />
  }
  return <Normal />
}
export default InputAreaContainer
