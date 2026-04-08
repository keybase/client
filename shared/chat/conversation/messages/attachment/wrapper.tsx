import type AudioAttachmentType from './audio'
import type FileAttachmentType from './file'
import type ImageAttachmentType from './image'
import type VideoAttachmentType from './video'
import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'

export function WrapperAttachmentAudio(p: Props) {
  const {ordinal, isCenteredHighlight = false} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData
  if (message.type !== 'attachment') {
    return null
  }
  const {default: AudioAttachment} = require('./audio') as {default: typeof AudioAttachmentType}
  return (
    <WrapperMessage {...p} {...wrapper}>
      <AudioAttachment message={message} />
    </WrapperMessage>
  )
}
export function WrapperAttachmentFile(p: Props) {
  const {ordinal, isCenteredHighlight = false} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {showPopup} = wrapper
  const {message, isEditing} = wrapper.messageData
  if (message.type !== 'attachment') {
    return null
  }

  const {default: FileAttachment} = require('./file') as {default: typeof FileAttachmentType}

  return (
    <WrapperMessage {...p} {...wrapper}>
      <FileAttachment isEditing={isEditing} message={message} ordinal={ordinal} showPopup={showPopup} />
    </WrapperMessage>
  )
}
export function WrapperAttachmentVideo(p: Props) {
  const {ordinal, isCenteredHighlight = false} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {showPopup} = wrapper
  const {message} = wrapper.messageData
  if (message.type !== 'attachment') {
    return null
  }
  const {default: VideoAttachment} = require('./video') as {default: typeof VideoAttachmentType}

  return (
    <WrapperMessage {...p} {...wrapper}>
      <VideoAttachment message={message} ordinal={ordinal} showPopup={showPopup} />
    </WrapperMessage>
  )
}
export function WrapperAttachmentImage(p: Props) {
  const {ordinal, isCenteredHighlight = false} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {showPopup} = wrapper
  const {message} = wrapper.messageData
  if (message.type !== 'attachment') {
    return null
  }
  const {default: ImageAttachment} = require('./image') as {default: typeof ImageAttachmentType}

  return (
    <WrapperMessage {...p} {...wrapper}>
      <ImageAttachment message={message} ordinal={ordinal} showPopup={showPopup} />
    </WrapperMessage>
  )
}
