import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import {PerfProfiler} from '@/perf/react-profiler'
import Normal from './normal'
import Preview from './preview'
import ThreadSearch from '../search'
import {useThreadSearchRoute} from '../thread-search-route'
import {useConversationThreadID, useThreadMeta} from '../thread-context'

const InputAreaContainer = () => {
  const conversationIDKey = useConversationThreadID()
  const showThreadSearch = !!useThreadSearchRoute()
  const {membershipType, resetParticipants, wasFinalizedBy} = useThreadMeta(
    C.useShallow(m => ({
      membershipType: m.membershipType,
      resetParticipants: m.resetParticipants,
      wasFinalizedBy: m.wasFinalizedBy,
    }))
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
  if (showThreadSearch && isMobile) {
    return <ThreadSearch />
  }
  return <PerfProfiler id="ChatInput"><Normal /></PerfProfiler>
}
export default InputAreaContainer
