import type * as React from 'react'
export type Props = {
  children: React.ReactNode
  setCloseOpenedRow: (fn: () => void) => void
  closeOpenedRow: () => void
}
declare const SwipeConvActions: (p: Props) => React.ReactNode
export default SwipeConvActions
