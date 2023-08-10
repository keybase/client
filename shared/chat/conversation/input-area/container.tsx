import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import type * as Types from '../../../constants/types/chat2'
import Normal from './normal'
import Preview from './preview/container'
import ThreadSearch from '../search/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  focusInputCounter: number
  jumpToRecent: () => void
  onRequestScrollDown: () => void
  onRequestScrollToBottom: () => void
  onRequestScrollUp: () => void
}

const InputAreaContainer = (p: OwnProps) => {
  const {conversationIDKey, focusInputCounter, jumpToRecent} = p
  const {onRequestScrollUp, onRequestScrollDown, onRequestScrollToBottom} = p
  const showThreadSearch = Constants.useContext(s => s.threadSearchInfo.visible)
  const {membershipType, resetParticipants, wasFinalizedBy} = Constants.useContext(s => s.meta)

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
    return <ThreadSearch conversationIDKey={p.conversationIDKey} />
  }
  return (
    <Normal
      focusInputCounter={focusInputCounter}
      jumpToRecent={jumpToRecent}
      onRequestScrollDown={onRequestScrollDown}
      onRequestScrollToBottom={onRequestScrollToBottom}
      onRequestScrollUp={onRequestScrollUp}
      conversationIDKey={conversationIDKey}
    />
  )
}
export default InputAreaContainer
