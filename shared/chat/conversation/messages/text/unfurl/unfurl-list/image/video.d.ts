import type * as React from 'react'
export type Props = {
  autoPlay: boolean
  height: number
  style: object
  onClick?: () => void
  url: string
  width: number
}
export declare const Video: (p: Props) => React.ReactNode
