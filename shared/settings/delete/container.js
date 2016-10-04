// @flow
import {TypedConnector} from '../../util/typed-connect'
import {routeAppend} from '../../actions/router'
import Delete from './index'

import type {TypedDispatch} from '../../constants/types/flux'
import type {TypedState} from '../../constants/reducer'
import type {Props} from './index'

const connector: TypedConnector<TypedState, TypedDispatch<{}>, {}, Props> = new TypedConnector()

export default connector.connect(
  (state, dispatch, ownProps) => {
    const currentDevice = state.devices.devices.find(d => d.currentDevice)

    return {
      onRevokeCurrentDevice: () => { dispatch(routeAppend({path: 'removeDevice', device: currentDevice})) },
      onDelete: () => { dispatch(routeAppend({path: 'deleteConfirm'})) },
    }
  }
)(Delete)
