import {StylesDesktop} from '../styles'

export type Props = {
  forwardedRef?: any
  src: string
  style?: StylesDesktop
  onDragStart?: (e: React.SyntheticEvent) => void
  onLoad?: (e: React.SyntheticEvent) => void
}
