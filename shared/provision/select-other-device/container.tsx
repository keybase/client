import * as React from 'react'
import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import * as Constants from '../../constants/provision'
import * as AutoresetGen from '../../actions/autoreset-gen'
import SelectOtherDevice from '.'

const SelectOtherDeviceContainer = () => {
  const devices = Container.useSelector(state => state.provision.devices)
  const username = Container.useSelector(state => state.provision.username)
  const waiting = Container.useSelector(state => Container.anyWaiting(state, Constants.waitingKey))

  const dispatch = Container.useDispatch()
  const _onBack = React.useCallback(() => {
    dispatch(RouteTreeGen.createNavigateUp())
  }, [dispatch])
  const onBack = Container.useSafeSubmit(_onBack, false)
  const onResetAccount = React.useCallback(() => {
    dispatch(AutoresetGen.createStartAccountReset({skipPassword: false, username}))
  }, [dispatch, username])
  const _onSelect = React.useCallback(
    (name: string) => {
      !waiting && dispatch(ProvisionGen.createSubmitDeviceSelect({name}))
    },
    [dispatch, waiting]
  )
  const onSelect = Container.useSafeSubmit(_onSelect, false)
  return (
    <SelectOtherDevice
      devices={devices}
      onBack={onBack}
      onSelect={onSelect}
      onResetAccount={onResetAccount}
    />
  )
}
export default SelectOtherDeviceContainer
