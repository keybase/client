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

class InputArea extends React.PureComponent<Props> {
  render() {
    if (this.props.noInput) {
      return null
    }
    if (this.props.isPreview) {
      return <Preview conversationIDKey={this.props.conversationIDKey} />
    }
    if (this.props.showThreadSearch && Container.isMobile) {
      return <ThreadSearch conversationIDKey={this.props.conversationIDKey} />
    }
    if (this.props.showAudioSend) {
      return <AudioSend conversationIDKey={this.props.conversationIDKey} />
    }
    return (
      <Normal
        focusInputCounter={this.props.focusInputCounter}
        jumpToRecent={this.props.jumpToRecent}
        onRequestScrollDown={this.props.onRequestScrollDown}
        onRequestScrollToBottom={this.props.onRequestScrollToBottom}
        onRequestScrollUp={this.props.onRequestScrollUp}
        conversationIDKey={this.props.conversationIDKey}
        maxInputArea={this.props.maxInputArea}
      />
    )
  }
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
