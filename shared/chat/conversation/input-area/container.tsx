import * as React from 'react'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import type * as Types from '../../../constants/types/chat2'
import Normal from './normal'
import Preview from './preview/container'
import ThreadSearch from '../search/container'
import {ShowAudioSendContext, AudioSendWrapper} from '../../audio/audio-send'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  focusInputCounter: number
  jumpToRecent: () => void
  onRequestScrollDown: () => void
  onRequestScrollToBottom: () => void
  onRequestScrollUp: () => void
  maxInputArea?: number
}

export default (p: OwnProps) => {
  const {
    conversationIDKey,
    focusInputCounter,
    jumpToRecent,
    onRequestScrollUp,
    onRequestScrollDown,
    onRequestScrollToBottom,
    maxInputArea,
  } = p
  const [showAudioSend, setShowAudioSend] = React.useState(false)
  const value = React.useMemo(() => ({setShowAudioSend, showAudioSend}), [showAudioSend, setShowAudioSend])

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
  if (showAudioSend) {
    return <AudioSendWrapper />
  }
  return (
    <ShowAudioSendContext.Provider value={value}>
      <Normal
        focusInputCounter={focusInputCounter}
        jumpToRecent={jumpToRecent}
        onRequestScrollDown={onRequestScrollDown}
        onRequestScrollToBottom={onRequestScrollToBottom}
        onRequestScrollUp={onRequestScrollUp}
        conversationIDKey={conversationIDKey}
        maxInputArea={maxInputArea}
      />
    </ShowAudioSendContext.Provider>
  )
}
