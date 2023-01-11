import * as React from 'react'

export type Props = {
  children: React.ReactNode
  isMuted: boolean
  onHideConversation: () => void
  onMuteConversation: () => void
  swipeCloseRef?: React.MutableRefObject<(() => void) | null>
  // if something can trigger a reset of this, then mutate this data
  extraData?: unknown
}

declare class SwipeConvActions extends React.Component<Props> {}
export default SwipeConvActions
