import * as React from 'react'
import * as ProvisionGen from '../../../actions/provision-gen'
import * as Constants from '../../../constants/provision'
import * as WaitingConstants from '../../../constants/waiting'
import * as Container from '../../../util/container'
import CodePage2 from '.'
import HiddenString from '../../../util/hidden-string'

export default () => {
  const error = Container.useSelector(state => state.provision.error.stringValue())
  const waiting = Container.useSelector(state => WaitingConstants.anyWaiting(state, Constants.waitingKey))
  const dispatch = Container.useDispatch()
  const _onSubmitTextCode = React.useCallback(
    () => (code: string) => dispatch(ProvisionGen.createSubmitTextCode({phrase: new HiddenString(code)})),
    [dispatch]
  )
  const onSubmitTextCode = Container.useSafeSubmit(_onSubmitTextCode, !!error)
  return <CodePage2 onSubmitTextCode={onSubmitTextCode} waiting={waiting} />
}
