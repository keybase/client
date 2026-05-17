export type UploadProps = {
  showing: boolean
  files: number
  fileName?: string
  totalSyncingBytes: number
  timeLeft: string
  debugToggleShow?: () => void
  smallMode?: boolean
}
