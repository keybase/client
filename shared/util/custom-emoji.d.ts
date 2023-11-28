import type * as Styles from '@/styles'

export type Props = {
  size: number
  src: string
  alias?: string
  style?: Styles.StylesCrossPlatform
}

declare const CustomEmoji: (p: Props) => React.ReactNode
export default CustomEmoji
