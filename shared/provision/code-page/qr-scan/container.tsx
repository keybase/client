import * as React from 'react'
import * as C from '../../../constants'
import * as Container from '../../../util/container'
import QRScan from '.'

const QRScanContainer = () => {
  const submitTextCode = C.useProvisionState(s => s.dispatch.dynamic.submitTextCode)
  const waiting = Container.useAnyWaiting(C.provisionWaitingKey)
  const onSubmitTextCode = (c: string) => submitTextCode?.(c)
  return <QRScan onSubmitTextCode={onSubmitTextCode} waiting={waiting} />
}
export default QRScanContainer
