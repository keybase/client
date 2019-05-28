import * as React from 'react'
export type Props = {
  onSubmitCode: (code: string | null) => void
}
declare class QRScan extends React.Component<Props> {}
export default QRScan
