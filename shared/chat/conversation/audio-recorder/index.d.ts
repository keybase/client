import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
export type Props = {
  conversationIDKey: Types.ConversationIDKey
  onMetering: (amp: number) => void
  onStopRecording: (stopType: Types.AudioStopType) => void
}
export default class AudioRecorder extends React.Component<Props> {}
