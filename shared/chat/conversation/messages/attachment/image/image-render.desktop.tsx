import * as React from 'react'
import type {Props} from './image-render'
import {collapseStyles} from '../../../../../styles'

export const ImageRender = (p: Props) => {
  const {src, onLoad, onLoadedVideo, loaded, style, videoSrc, inlineVideoPlayable} = p
  const videoRef = React.useRef<HTMLVideoElement | null>(null)

  return inlineVideoPlayable ? (
    <video
      ref={videoRef}
      poster={src}
      preload="none"
      onLoadStart={onLoad}
      onLoadedMetadata={onLoadedVideo}
      controlsList="nodownload nofullscreen noremoteplayback"
      style={collapseStyles([style, !loaded && {opacity: 0}])}
    >
      <source src={videoSrc} />
    </video>
  ) : (
    <img
      onLoad={onLoad}
      draggable={false}
      src={src}
      style={collapseStyles([style, !loaded && {opacity: 0}])}
    />
  )
}

export function imgMaxWidth() {
  return 320
}

export function imgMaxWidthRaw() {
  return 320
}
