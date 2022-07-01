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
