import * as React from 'react'

export type Props = {
  children: React.ReactNode
  isMuted: boolean
  onHideConversation: () => void
  onMuteConversation: () => void
}

declare class ConvActions extends React.Component<Props> {}
export default ConvActions
