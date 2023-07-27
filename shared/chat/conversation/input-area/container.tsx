import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import type * as Types from '../../../constants/types/chat2'
import Normal from './normal'
import Preview from './preview/container'
import ThreadSearch from '../search/container'
import shallowEqual from 'shallowequal'

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
  const {membershipType, resetParticipants, wasFinalizedBy} = Container.useSelector(state => {
    const meta = Constants.getMeta(state, conversationIDKey)
    const {membershipType, resetParticipants, wasFinalizedBy} = meta
    return {membershipType, resetParticipants, wasFinalizedBy}
  }, shallowEqual)

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
    />
  )
}
export default InputAreaContainer
