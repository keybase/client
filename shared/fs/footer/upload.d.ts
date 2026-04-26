import type * as React from 'react'

export type UploadProps = {
  showing: boolean
  files: number
  fileName?: string | undefined
  totalSyncingBytes: number
  timeLeft: string
  debugToggleShow?: (() => void) | undefined
  smallMode?: boolean | undefined
}

declare const Upload: (p: UploadProps) => React.ReactNode
export default Upload
