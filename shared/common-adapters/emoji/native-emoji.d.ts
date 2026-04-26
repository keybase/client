import type * as React from 'react'
import type {StylesCrossPlatform} from '@/styles'

export type Props = {
  size: 16 | 18 | 22 | 24 | 26 | 28 | 32 | 36
  emojiName: string
  disableSelecting?: boolean | undefined // desktop only - helps with chrome copy/paste bug workarounds
  allowFontScaling?: boolean | undefined
  style?: StylesCrossPlatform | undefined
}

declare const Emoji: (p: Props) => React.ReactNode
export default Emoji
