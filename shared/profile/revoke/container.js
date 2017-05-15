// @flow
import Revoke from './index'
import {TypedConnector} from '../../util/typed-connect'
import {submitRevokeProof, finishRevoking, dropPgp} from '../../actions/profile'

import type {PlatformsExpandedType} from '../../constants/types/more'
import type {RouteProps} from '../../route-tree/render-route'
import type {Props} from './index'
import type {TypedState} from '../../constants/reducer'
import type {TypedDispatch} from '../../constants/types/flux'

type OwnProps = RouteProps<
  {
    platform: PlatformsExpandedType,
    proofId: string,
    platformHandle: string,
  },
  {}
>

const connector: TypedConnector<TypedState, TypedDispatch<{}>, OwnProps, Props> = new TypedConnector()

export default connector.connect((state, dispatch, {routeProps}) => ({
  isWaiting: state.profile.revoke.waiting,
  errorMessage: state.profile.revoke.error,
  onCancel: () => {
    dispatch(finishRevoking())
  },
  onRevoke: () => {
    if (routeProps.platform === 'pgp') {
      dispatch(dropPgp(routeProps.proofId))
    } else {
      dispatch(submitRevokeProof(routeProps.proofId))
    }
  },
  platform: routeProps.platform,
  platformHandle: routeProps.platformHandle,
}))(Revoke)
