import * as Container from '../../util/container'
import * as React from 'react'
import * as DevicesGen from '../../actions/devices-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ProvisionGen from '../../actions/provision-gen'
import * as Constants from '../../constants/devices'
import AddDevice from '.'

type OwnProps = Container.RouteProps<'deviceAdd'>
const noHighlight = []

export default (ownProps: OwnProps) => {
  const iconNumbers = Container.useSelector(state => Constants.getNextDeviceIconNumber(state))
  const dispatch = Container.useDispatch()
  const onAddComputer = React.useCallback(
    () => dispatch(ProvisionGen.createAddNewDevice({otherDeviceType: 'desktop'})),
    [dispatch]
  )
  const onAddPaperKey = React.useCallback(() => dispatch(DevicesGen.createShowPaperKeyPage()), [dispatch])
  const onAddPhone = React.useCallback(
    () => dispatch(ProvisionGen.createAddNewDevice({otherDeviceType: 'mobile'})),
    [dispatch]
  )
  const onCancel = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])

  const props = {
    highlight: ownProps.route.params?.highlight ?? noHighlight,
    iconNumbers,
    onAddComputer,
    onAddPaperKey,
    onAddPhone,
    onCancel,
  }
  return <AddDevice {...props} />
}
