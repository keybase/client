import * as Kb from '@/common-adapters'
import type AudioAttachmentType from './audio'
import type FileAttachmentType from './file'
import type ImageAttachmentType from './image'
import type VideoAttachmentType from './video'
import {WrapperMessage, useCommonWithData, useMessageData, type Props} from '../wrapper/wrapper'

export function WrapperAttachmentAudio(p: Props) {
  const {ordinal} = p
  const messageData = useMessageData(ordinal)
  const common = useCommonWithData(ordinal, messageData)
  const {default: AudioAttachment} = require('./audio') as {default: typeof AudioAttachmentType}
  return (
    <WrapperMessage {...p} {...common} messageData={messageData}>
      <AudioAttachment />
    </WrapperMessage>
  )
}
export function WrapperAttachmentFile(p: Props) {
  const {ordinal} = p
  const messageData = useMessageData(ordinal)
  const common = useCommonWithData(ordinal, messageData)
  const {showPopup} = common

  const {default: FileAttachment} = require('./file') as {default: typeof FileAttachmentType}

  return (
    <WrapperMessage {...p} {...common} messageData={messageData}>
      <FileAttachment showPopup={showPopup} />
    </WrapperMessage>
  )
}
export function WrapperAttachmentVideo(p: Props) {
  const {ordinal} = p
  const messageData = useMessageData(ordinal)
  const common = useCommonWithData(ordinal, messageData)
  const {showPopup} = common
  const {default: VideoAttachment} = require('./video') as {default: typeof VideoAttachmentType}

  return (
    <WrapperMessage {...p} {...common} messageData={messageData}>
      <VideoAttachment showPopup={showPopup} />
    </WrapperMessage>
  )
}
export function WrapperAttachmentImage(p: Props) {
  const {ordinal} = p
  const messageData = useMessageData(ordinal)
  const common = useCommonWithData(ordinal, messageData)
  const {showPopup} = common
  const {default: ImageAttachment} = require('./image') as {default: typeof ImageAttachmentType}

  return (
    <WrapperMessage {...p} {...common} messageData={messageData}>
      <ImageAttachment showPopup={showPopup} />
    </WrapperMessage>
  )
}
