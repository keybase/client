import {StylesCrossPlatform} from '../styles'

export type Props = {
  forwardedRef?: any
  src: string
  style?: StylesCrossPlatform
  onDragStart?: (e: React.SyntheticEvent) => void
  onLoad?: (e: React.SyntheticEvent) => void
}
