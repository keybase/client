import type * as React from 'react'

export type Props = {
  url: string
  paused: boolean
  onPositionUpdated: (ratio: number) => void
  onEnded: () => void
}

declare const AudioVideo: (p: Props) => React.ReactNode
export default AudioVideo
