import * as React from 'react'
export type Props = {
  waiting: boolean
  mountKey: string
  onSubmitTextCode: (arg0: string) => void
  onOpenSettings: () => void
}
declare class QRScan extends React.Component<Props> {}
export default QRScan
