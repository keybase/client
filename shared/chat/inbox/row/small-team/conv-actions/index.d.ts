import * as React from 'react'

export type Props = {
  isMuted: boolean
  onHideConversation: () => void
  onMuteConversation: () => void
  progress: any
}

export declare class ConvActions extends React.Component<Props> {}
