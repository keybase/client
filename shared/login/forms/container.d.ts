import type * as React from 'react'
import type * as Kb from '@/common-adapters'

export type Props = {
  onBack?: () => void
  children?: React.ReactNode
  style?: Kb.Styles.StylesCrossPlatform
  outerStyle?: Kb.Styles.StylesCrossPlatform
}

declare const Container: (p: Props) => React.ReactNode
export default Container
