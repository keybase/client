import type * as Kb from '@/common-adapters'
import type * as React from 'react'

export type Props = {
  onBack?: () => void
  children?: React.ReactNode
  style?: Kb.Styles.StylesCrossPlatform
  outerStyle?: Kb.Styles.StylesCrossPlatform
}
