import * as React from 'react'
import * as C from '@/constants'
import QRScan from '.'

const QRScanContainer = () => {
  const submitTextCode = C.useProvisionState(s => s.dispatch.dynamic.submitTextCode)
  const waiting = C.Waiting.useAnyWaiting(C.Provision.waitingKey)
  const onSubmitTextCode = (c: string) => submitTextCode?.(c)
  return <QRScan onSubmitTextCode={onSubmitTextCode} waiting={waiting} />
}
export default QRScanContainer
