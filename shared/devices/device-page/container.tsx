import * as Container from '../../util/container'
import * as React from 'react'
import * as Constants from '../../constants/devices'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import DevicePage from '.'

type OwnProps = Container.RouteProps<'devicePage'>

export const options = {
  title: '',
}

export default (ownProps: OwnProps) => {
  const id = ownProps.route.params?.deviceID ?? ''
  const iconNumber = Container.useSelector(state => Constants.getDeviceIconNumber(state, id))

  const dispatch = Container.useDispatch()
  const onBack = React.useCallback(() => {
    Container.isMobile && dispatch(RouteTreeGen.createNavigateUp())
  }, [dispatch])
  const props = {
    iconNumber,
    id,
    onBack,
  }
  return <DevicePage {...props} />
}
