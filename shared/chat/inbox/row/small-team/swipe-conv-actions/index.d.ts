import * as React from 'react'

export type Props = {
  children: React.ReactNode
  swipeCloseRef?: React.MutableRefObject<(() => void) | null>
}

declare class SwipeConvActions extends React.Component<Props> {}
export default SwipeConvActions
