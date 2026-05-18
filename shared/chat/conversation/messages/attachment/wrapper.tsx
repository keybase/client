import AudioAttachment from './audio'
import FileAttachment from './file'
import ImageAttachment from './image'
import VideoAttachment from './video'
import {WrapperMessage, useWrapperMessageWithMessage, type Props} from '../wrapper/wrapper'

export function WrapperAttachmentAudio(p: Props) {
  const {ordinal, isCenteredHighlight = false} = p
  const wrapper = useWrapperMessageWithMessage(ordinal, isCenteredHighlight)
  const {message} = wrapper.messageData
  if (message.type !== 'attachment') {
    return null
  }
  return (
    <WrapperMessage {...p} {...wrapper}>
      <AudioAttachment message={message} ordinal={ordinal} />
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

  return (
    <WrapperMessage {...p} {...wrapper}>
      <ImageAttachment message={message} ordinal={ordinal} showPopup={showPopup} />
    </WrapperMessage>
  )
}
