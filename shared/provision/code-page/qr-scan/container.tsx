import * as React from 'react'
import * as Constants from '../../../constants/provision'
import * as Container from '../../../util/container'
import QRScan from '.'

const QRScanContainer = () => {
  const submitTextCode = Constants.useState(s => s.dispatch.submitTextCode)
  const waiting = Container.useAnyWaiting(Constants.waitingKey)
  const onSubmitTextCode = submitTextCode
  return <QRScan onSubmitTextCode={onSubmitTextCode} waiting={waiting} />
}
export default QRScanContainer
