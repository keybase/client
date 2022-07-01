import * as React from 'react'

export type UploadProps = {
  showing: boolean
  files: number
  fileName: string | null
  totalSyncingBytes: number
  timeLeft: string
  debugToggleShow?: () => void
  smallMode?: boolean
}

export default class extends React.PureComponent<UploadProps> {}
