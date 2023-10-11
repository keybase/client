import type * as React from 'react'
export type Props = {
  children: React.ReactNode
  swipeCloseRef?: React.MutableRefObject<(() => void) | null>
  onClick?: () => void
}
declare const SwipeConvActions: (p: Props) => React.ReactNode
export default SwipeConvActions
