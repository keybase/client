import type * as React from 'react'
export type Props = {
  waiting: boolean
  onSubmitTextCode: (s: string) => void
}
declare const QRScan: (p: Props) => React.ReactNode
export default QRScan
