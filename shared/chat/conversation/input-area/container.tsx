import * as C from '@/constants'
import Normal from './normal'
import Preview from './preview/container'
import ThreadSearch from '../search/container'

const InputAreaContainer = () => {
  const conversationIDKey = C.useChatContext(s => s.id)
  const showThreadSearch = C.useChatContext(s => s.threadSearchInfo.visible)
  const {membershipType, resetParticipants, wasFinalizedBy} = C.useChatContext(
    C.useShallow(s => {
      const {membershipType, resetParticipants, wasFinalizedBy} = s.meta
      return {membershipType, resetParticipants, wasFinalizedBy}
    })
  )

  let noInput = resetParticipants.size > 0 || !!wasFinalizedBy
  if (
    conversationIDKey === C.Chat.pendingWaitingConversationIDKey ||
    conversationIDKey === C.Chat.pendingErrorConversationIDKey
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
