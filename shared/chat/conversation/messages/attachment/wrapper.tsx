import type AudioAttachmentType from './audio'
import type FileAttachmentType from './file'
import type ImageAttachmentType from './image'
import type VideoAttachmentType from './video'
import {WrapperMessage, useWrapperMessage, type Props} from '../wrapper/wrapper'

export function WrapperAttachmentAudio(p: Props) {
  const {ordinal, isCenteredHighlight = false} = p
  const wrapper = useWrapperMessage(ordinal, isCenteredHighlight)
  const {default: AudioAttachment} = require('./audio') as {default: typeof AudioAttachmentType}
  return (
    <WrapperMessage {...p} {...wrapper}>
      <AudioAttachment />
    </WrapperMessage>
  )
}
export function WrapperAttachmentFile(p: Props) {
  const {ordinal, isCenteredHighlight = false} = p
  const wrapper = useWrapperMessage(ordinal, isCenteredHighlight)
  const {showPopup} = wrapper

  const {default: FileAttachment} = require('./file') as {default: typeof FileAttachmentType}

  return (
    <WrapperMessage {...p} {...wrapper}>
      <FileAttachment showPopup={showPopup} />
    </WrapperMessage>
  )
}
export function WrapperAttachmentVideo(p: Props) {
  const {ordinal, isCenteredHighlight = false} = p
  const wrapper = useWrapperMessage(ordinal, isCenteredHighlight)
  const {showPopup} = wrapper
  const {default: VideoAttachment} = require('./video') as {default: typeof VideoAttachmentType}

  return (
    <WrapperMessage {...p} {...wrapper}>
      <VideoAttachment showPopup={showPopup} />
    </WrapperMessage>
  )
}
export function WrapperAttachmentImage(p: Props) {
  const {ordinal, isCenteredHighlight = false} = p
  const wrapper = useWrapperMessage(ordinal, isCenteredHighlight)
  const {showPopup} = wrapper
  const {default: ImageAttachment} = require('./image') as {default: typeof ImageAttachmentType}

  return (
    <WrapperMessage {...p} {...wrapper}>
      <ImageAttachment showPopup={showPopup} />
    </WrapperMessage>
  )
}
