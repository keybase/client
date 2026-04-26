import type * as Styles from '@/styles'

export type Props = {
  size: number
  src: string
  alias?: string | undefined
  style?: Styles.StylesCrossPlatform | undefined
}

declare const CustomEmoji: (p: Props) => React.ReactNode
export default CustomEmoji
