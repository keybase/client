import * as Container from '../../util/container'
import * as React from 'react'
import * as Constants from '../../constants/devices'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HeaderTitle as _HeaderTitle, HeaderRightActions as _HeaderRightActions} from '.'

export const HeaderTitle = () => {
  const {numActive, numRevoked} = Container.useSelector(state => Constants.getDeviceCounts(state))
  const props = {
    numActive,
    numRevoked,
  }
  return <_HeaderTitle {...props} />
}

export const HeaderRightActions = () => {
  const dispatch = Container.useDispatch()
  const onAdd = React.useCallback(
    () => dispatch(RouteTreeGen.createNavigateAppend({path: ['deviceAdd']})),
    [dispatch]
  )
  const props = {onAdd}
  return <_HeaderRightActions {...props} />
}
