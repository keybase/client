import * as React from 'react'
export type Props = {
  onSubmitCode: (code?: string) => void
}
declare class QRScan extends React.Component<Props> {}
export default QRScan
