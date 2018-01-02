// @flow
import * as LoginGen from '../../../actions/login-gen'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import SelectOtherDevice from '.'
import {connect, type TypedState} from '../../../util/container'
import {compose, withState} from 'recompose'
import {type RouteProps} from '../../../route-tree/render-route'
import openURL from '../../../util/open-url'

const ACCOUNT_RESET_URL = 'https://keybase.io/#account-reset'

type OwnProps = RouteProps<
  {
    devices: Array<RPCTypes.Device>,
    canSelectNoDevice: boolean,
  },
  {}
>

const mapStateToProps = (s: TypedState, {routeProps}: OwnProps) => ({
  devices: routeProps.get('devices'),
  canSelectNoDevice: routeProps.get('canSelectNoDevice'),
})
const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(LoginGen.createOnBack()),
  onWont: () => dispatch(LoginGen.createOnWont()),
  onSelect: deviceId => dispatch(LoginGen.createSelectDeviceId({deviceId})),
  onReset: () => {
    openURL(ACCOUNT_RESET_URL)
    dispatch(LoginGen.createOnBack())
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('showResetLink', 'setShowResetLink', false)
)(SelectOtherDevice)
