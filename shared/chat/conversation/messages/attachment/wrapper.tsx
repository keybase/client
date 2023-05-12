import * as React from 'react'
import type AudioAttachmentType from './audio'
import type FileAttachmentType from './file/container'
import type ImageAttachmentType from './image2'
import type VideoAttachmentType from './video'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'

export const WrapperAttachmentAudio = React.memo(function WrapperAttachmentAudio(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const AudioAttachment = require('./audio').default as typeof AudioAttachmentType
  return (
    <WrapperMessage {...p} {...common}>
      <AudioAttachment />
    </WrapperMessage>
  )
})
export const WrapperAttachmentFile = React.memo(function WrapperAttachmentFile(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const {toggleShowingPopup} = common

  const FileAttachment = require('./file/container').default as typeof FileAttachmentType

  return (
    <WrapperMessage {...p} {...common}>
      <FileAttachment toggleMessageMenu={toggleShowingPopup} />
    </WrapperMessage>
  )
})
export const WrapperAttachmentVideo = React.memo(function WrapperAttachmentVideo(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const {toggleShowingPopup} = common
  const VideoAttachment = require('./video').default as typeof VideoAttachmentType

  return (
    <WrapperMessage {...p} {...common}>
      <VideoAttachment toggleMessageMenu={toggleShowingPopup} />
    </WrapperMessage>
  )
})
export const WrapperAttachmentImage = React.memo(function WrapperAttachmentImage(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const {toggleShowingPopup} = common
  const ImageAttachment = require('./image2').default as typeof ImageAttachmentType

  return (
    <WrapperMessage {...p} {...common}>
      <ImageAttachment toggleMessageMenu={toggleShowingPopup} />
    </WrapperMessage>
  )
})
