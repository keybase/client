import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import AudioPlayer from '../../../audio/audio-player'

type Props = {
  message: Types.MessageAttachment
}

const AudioAttachment = (props: Props) => {
  const {message} = props
  const url = `${message.fileURL}&contentforce=true`
  return (
    <AudioPlayer
      duration={message.audioDuration}
      url={url}
      visUrl={message.previewURL}
      visHeight={message.previewHeight}
      visWidth={message.previewWidth}
    />
  )
}

export default AudioAttachment
