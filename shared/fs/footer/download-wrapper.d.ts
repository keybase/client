import type * as React from 'react'

export type Props = {
  dismiss: () => void
  done: boolean
  isFirst: boolean
  children: React.ReactNode
}

declare const DownloadWrapper: (p: Props) => React.ReactNode
export default DownloadWrapper
