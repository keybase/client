import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as ConvoState from '@/stores/convostate'
import {PerfProfiler} from '@/perf/react-profiler'
import Normal from './normal'
import Preview from './preview'
import ThreadSearch from '../search'
import {useThreadSearchRoute} from '../thread-search-route'

const InputAreaContainer = () => {
  const conversationIDKey = ConvoState.useChatContext(s => s.id)
  const showThreadSearch = !!useThreadSearchRoute()
  const {membershipType, resetParticipants, wasFinalizedBy} = ConvoState.useChatContext(
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
  return <PerfProfiler id="ChatInput"><Normal /></PerfProfiler>
}
export default InputAreaContainer
