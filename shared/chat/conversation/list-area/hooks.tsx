import * as C from '@/constants'
import JumpToRecent from '@/chat/conversation/list-area/jump-to-recent'
import {useConversationCenter} from '@/chat/conversation/center-context'
import {
  useConversationThreadMarkThreadAsRead,
  useConversationThreadSelector,
  useConversationThreadToggleSearch,
} from '@/chat/conversation/thread-context'

export const useActions = () => {
  const markThreadAsRead = useConversationThreadMarkThreadAsRead()
  const markInitiallyLoadedThreadAsRead = () => {
    markThreadAsRead()
  }

  return {markInitiallyLoadedThreadAsRead}
}

export const useJumpToRecent = (scrollToBottom: () => void, numOrdinals: number) => {
  const {moreToLoadForward, loaded} = useConversationThreadSelector(
    C.useShallow(s => ({loaded: s.loaded, moreToLoadForward: s.moreToLoadForward}))
  )
  const toggleThreadSearch = useConversationThreadToggleSearch()
  const {jumpToRecent} = useConversationCenter()

  const onJump = () => {
    scrollToBottom()
    jumpToRecent()
    toggleThreadSearch(true)
  }

  return loaded && moreToLoadForward && numOrdinals > 0 && <JumpToRecent onClick={onJump} />
}
