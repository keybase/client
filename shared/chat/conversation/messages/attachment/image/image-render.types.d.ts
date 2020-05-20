import * as Styles from '../../../../../styles'

export type Props = {
  onLoad: () => void
  src: string
  height: number
  width: number
  style?: Styles.StylesCrossPlatform
  loaded: boolean
}
