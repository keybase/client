import * as React from 'react'
import * as ProvisionGen from '../../../actions/provision-gen'
import * as Constants from '../../../constants/provision'
import * as Container from '../../../util/container'
import QRScan from '.'
import HiddenString from '../../../util/hidden-string'

const QRScanContainer = () => {
  const error = Constants.useState(s => s.error)
  const waiting = Container.useAnyWaiting(Constants.waitingKey)
  const dispatch = Container.useDispatch()
  const _onSubmitTextCode = React.useCallback(
    (code: string) => {
      dispatch(ProvisionGen.createSubmitTextCode({phrase: new HiddenString(code)}))
    },
    [dispatch]
  )
  const onSubmitTextCode = Container.useSafeSubmit(_onSubmitTextCode, !!error)
  return <QRScan onSubmitTextCode={onSubmitTextCode} waiting={waiting} />
}
export default QRScanContainer
