import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import Normal from './normal/container'
import Preview from './preview/container'
import ThreadSearch from '../search/container'
import AudioSend from '../../audio/audio-send'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  focusInputCounter: number
  jumpToRecent: () => void
  onRequestScrollDown: () => void
  onRequestScrollToBottom: () => void
  onRequestScrollUp: () => void
  maxInputArea?: number
}

type Props = {
  isPreview: boolean
  noInput: boolean
  showAudioSend: boolean
  showThreadSearch: boolean
} & OwnProps

const InputArea = (p: Props) => {
  if (p.noInput) {
    return null
  }
  if (p.isPreview) {
    return <Preview conversationIDKey={p.conversationIDKey} />
  }
  if (p.showThreadSearch && Container.isMobile) {
    return <ThreadSearch conversationIDKey={p.conversationIDKey} />
  }
  if (p.showAudioSend) {
    return <AudioSend conversationIDKey={p.conversationIDKey} />
  }
  return (
    <Normal
      focusInputCounter={p.focusInputCounter}
      jumpToRecent={p.jumpToRecent}
      onRequestScrollDown={p.onRequestScrollDown}
      onRequestScrollToBottom={p.onRequestScrollToBottom}
      onRequestScrollUp={p.onRequestScrollUp}
      conversationIDKey={p.conversationIDKey}
      maxInputArea={p.maxInputArea}
    />
  )
}

export default Container.connect(
  (state, {conversationIDKey, maxInputArea}: OwnProps) => {
    const meta = Constants.getMeta(state, conversationIDKey)
    let noInput = meta.resetParticipants.size > 0 || !!meta.wasFinalizedBy
    const showThreadSearch = Constants.getThreadSearchInfo(state, conversationIDKey).visible
    const audio = state.chat2.audioRecording.get(conversationIDKey)
    const showAudioSend = !!audio && audio.status === Types.AudioRecordingStatus.STAGED

    if (
      conversationIDKey === Constants.pendingWaitingConversationIDKey ||
      conversationIDKey === Constants.pendingErrorConversationIDKey
    ) {
      noInput = true
    }

    return {
      conversationIDKey,
      isPreview: meta.membershipType === 'youArePreviewing',
      maxInputArea,
      noInput,
      showAudioSend,
      showThreadSearch,
    }
  },
  () => ({}),
  (s, _d, o: OwnProps) => ({...o, ...s})
)(InputArea)
