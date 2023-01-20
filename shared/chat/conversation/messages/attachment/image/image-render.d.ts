import * as React from 'react'
import type * as Styles from '../../../../../styles'
export type Props = {
  onLoad: () => void
  onLoadedVideo: () => void
  src: string
  height: number
  width: number
  videoSrc: string
  style: Styles.StylesCrossPlatform
  loaded: boolean
  inlineVideoPlayable: boolean
}
export declare class ImageRender extends React.Component<Props> {}
export declare function imgMaxWidth(): number
export declare function imgMaxWidthRaw(): number
export declare function imgMaxHeightRaw(): number
