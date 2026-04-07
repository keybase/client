import type AudioAttachmentType from './audio'
import type FileAttachmentType from './file'
import type ImageAttachmentType from './image'
import type VideoAttachmentType from './video'
import {WrapperMessageView, useCommonWithData, useMessageData, type Props} from '../wrapper/wrapper'

export function WrapperAttachmentAudio(p: Props) {
  const {ordinal, isCenteredHighlight = false} = p
  const messageData = useMessageData(ordinal, isCenteredHighlight)
  const common = useCommonWithData(ordinal, messageData)
  const {default: AudioAttachment} = require('./audio') as {default: typeof AudioAttachmentType}
  return (
    <WrapperMessageView {...p} {...common} messageData={messageData}>
      <AudioAttachment />
    </WrapperMessageView>
  )
}
export function WrapperAttachmentFile(p: Props) {
  const {ordinal, isCenteredHighlight = false} = p
  const messageData = useMessageData(ordinal, isCenteredHighlight)
  const common = useCommonWithData(ordinal, messageData)
  const {showPopup} = common

  const {default: FileAttachment} = require('./file') as {default: typeof FileAttachmentType}

  return (
    <WrapperMessageView {...p} {...common} messageData={messageData}>
      <FileAttachment showPopup={showPopup} />
    </WrapperMessageView>
  )
}
export function WrapperAttachmentVideo(p: Props) {
  const {ordinal, isCenteredHighlight = false} = p
  const messageData = useMessageData(ordinal, isCenteredHighlight)
  const common = useCommonWithData(ordinal, messageData)
  const {showPopup} = common
  const {default: VideoAttachment} = require('./video') as {default: typeof VideoAttachmentType}

  return (
    <WrapperMessageView {...p} {...common} messageData={messageData}>
      <VideoAttachment showPopup={showPopup} />
    </WrapperMessageView>
  )
}
export function WrapperAttachmentImage(p: Props) {
  const {ordinal, isCenteredHighlight = false} = p
  const messageData = useMessageData(ordinal, isCenteredHighlight)
  const common = useCommonWithData(ordinal, messageData)
  const {showPopup} = common
  const {default: ImageAttachment} = require('./image') as {default: typeof ImageAttachmentType}

  return (
    <WrapperMessageView {...p} {...common} messageData={messageData}>
      <ImageAttachment showPopup={showPopup} />
    </WrapperMessageView>
  )
}
