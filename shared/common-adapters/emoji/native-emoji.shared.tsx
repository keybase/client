import type * as Styles from '@/styles'

export type Props = {
  size: 16 | 18 | 22 | 24 | 26 | 28 | 32 | 36
  emojiName: string
  disableSelecting?: boolean
  allowFontScaling?: boolean
  style?: Styles.StylesCrossPlatform
}
