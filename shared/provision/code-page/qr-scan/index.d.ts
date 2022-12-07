import * as React from 'react'
export type Props = {
  waiting: boolean
  onSubmitTextCode: (s: string) => void
}
declare class QRScan extends React.Component<Props> {}
export default QRScan
