import type * as React from 'react'

export type UploadProps = {
  showing: boolean
  files: number
  fileName?: string
  totalSyncingBytes: number
  timeLeft: string
  debugToggleShow?: () => void
  smallMode?: boolean
}

declare const Upload: (p: UploadProps) => React.ReactNode
export default Upload
