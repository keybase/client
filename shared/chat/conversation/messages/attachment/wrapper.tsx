import * as React from 'react'
import type AudioAttachmentType from './audio'
import type FileAttachmentType from './file/container'
import type ImageAttachmentType from './image2'
import type VideoAttachmentType from './video'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'

export const WrapperAttachmentAudio = React.memo(function WrapperAttachmentAudio(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const {default: AudioAttachment} = require('./audio') as {default: typeof AudioAttachmentType}
  return (
    <WrapperMessage {...p} {...common}>
      <AudioAttachment />
    </WrapperMessage>
  )
})
export const WrapperAttachmentFile = React.memo(function WrapperAttachmentFile(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const {showPopup} = common

  const {default: FileAttachment} = require('./file/container') as {default: typeof FileAttachmentType}

  return (
    <WrapperMessage {...p} {...common}>
      <FileAttachment showPopup={showPopup} />
    </WrapperMessage>
  )
})
export const WrapperAttachmentVideo = React.memo(function WrapperAttachmentVideo(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const {showPopup} = common
  const {default: VideoAttachment} = require('./video') as {default: typeof VideoAttachmentType}

  return (
    <WrapperMessage {...p} {...common}>
      <VideoAttachment showPopup={showPopup} />
    </WrapperMessage>
  )
})
export const WrapperAttachmentImage = React.memo(function WrapperAttachmentImage(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const {showPopup} = common
  const {default: ImageAttachment} = require('./image2') as {default: typeof ImageAttachmentType}

  return (
    <WrapperMessage {...p} {...common}>
      <ImageAttachment showPopup={showPopup} />
    </WrapperMessage>
  )
})
