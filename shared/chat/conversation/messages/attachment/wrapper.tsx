import type AudioAttachmentType from './audio'
import type FileAttachmentType from './file'
import type ImageAttachmentType from './image'
import type VideoAttachmentType from './video'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'

export function WrapperAttachmentAudio(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const {default: AudioAttachment} = require('./audio') as {default: typeof AudioAttachmentType}
  return (
    <WrapperMessage {...p} {...common}>
      <AudioAttachment />
    </WrapperMessage>
  )
}
export function WrapperAttachmentFile(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const {showPopup} = common

  const {default: FileAttachment} = require('./file') as {default: typeof FileAttachmentType}

  return (
    <WrapperMessage {...p} {...common}>
      <FileAttachment showPopup={showPopup} />
    </WrapperMessage>
  )
}
export function WrapperAttachmentVideo(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const {showPopup} = common
  const {default: VideoAttachment} = require('./video') as {default: typeof VideoAttachmentType}

  return (
    <WrapperMessage {...p} {...common}>
      <VideoAttachment showPopup={showPopup} />
    </WrapperMessage>
  )
}
export function WrapperAttachmentImage(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const {showPopup} = common
  const {default: ImageAttachment} = require('./image') as {default: typeof ImageAttachmentType}

  return (
    <WrapperMessage {...p} {...common}>
      <ImageAttachment showPopup={showPopup} />
    </WrapperMessage>
  )
}
