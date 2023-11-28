import type * as React from 'react'
import type * as Kb from '@/common-adapters'

export type Props = {
  style: Kb.Styles.StylesCrossPlatform
  children: React.ReactNode
}

declare const PendingPaymentBackground: (p: Props) => React.ReactNode
export default PendingPaymentBackground
