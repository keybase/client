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
  maxInputArea?: number
}

const InputAreaContainer = (p: OwnProps) => {
  const {conversationIDKey, focusInputCounter, jumpToRecent, maxInputArea} = p
  const {onRequestScrollUp, onRequestScrollDown, onRequestScrollToBottom} = p
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const showThreadSearch = Container.useSelector(
    state => Constants.getThreadSearchInfo(state, conversationIDKey).visible
  )

  let noInput = meta.resetParticipants.size > 0 || !!meta.wasFinalizedBy
  if (
    conversationIDKey === Constants.pendingWaitingConversationIDKey ||
    conversationIDKey === Constants.pendingErrorConversationIDKey
  ) {
    noInput = true
  }

  const isPreview = meta.membershipType === 'youArePreviewing'

  if (noInput) {
    return null
  }
  if (isPreview) {
    return <Preview conversationIDKey={p.conversationIDKey} />
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
      maxInputArea={maxInputArea}
    />
  )
}
export default InputAreaContainer
