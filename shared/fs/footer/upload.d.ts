import * as React from 'react'

export type UploadProps = {
  showing: boolean
  files: number
  fileName: string | null
  totalSyncingBytes: number
  timeLeft: string
  debugToggleShow?: () => void
}

export default class extends React.PureComponent<UploadProps> {}
