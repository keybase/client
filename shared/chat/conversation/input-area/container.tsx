import * as C from '../../../constants'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import Normal from './normal'
import Preview from './preview/container'
import ThreadSearch from '../search/container'

type OwnProps = {
  focusInputCounter: number
  jumpToRecent: () => void
  onRequestScrollDown: () => void
  onRequestScrollToBottom: () => void
  onRequestScrollUp: () => void
}

const InputAreaContainer = (p: OwnProps) => {
  const conversationIDKey = C.useChatContext(s => s.id)
  const {focusInputCounter, jumpToRecent} = p
  const {onRequestScrollUp, onRequestScrollDown, onRequestScrollToBottom} = p
  const showThreadSearch = C.useChatContext(s => s.threadSearchInfo.visible)
  const {membershipType, resetParticipants, wasFinalizedBy} = C.useChatContext(s => s.meta)

  let noInput = resetParticipants.size > 0 || !!wasFinalizedBy
  if (
    conversationIDKey === Constants.pendingWaitingConversationIDKey ||
    conversationIDKey === Constants.pendingErrorConversationIDKey
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
  if (showThreadSearch && Container.isMobile) {
    return <ThreadSearch />
  }
  return (
    <Normal
      focusInputCounter={focusInputCounter}
      jumpToRecent={jumpToRecent}
      onRequestScrollDown={onRequestScrollDown}
      onRequestScrollToBottom={onRequestScrollToBottom}
      onRequestScrollUp={onRequestScrollUp}
    />
  )
}
export default InputAreaContainer
