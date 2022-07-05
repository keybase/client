import * as ConfigGen from '../../../actions/config-gen'
import * as ProvisionGen from '../../../actions/provision-gen'
import * as Constants from '../../../constants/provision'
import * as WaitingConstants from '../../../constants/waiting'
import * as Container from '../../../util/container'
import CodePage2 from '.'
import HiddenString from '../../../util/hidden-string'

type OwnProps = {}

export default Container.namedConnect(
  state => ({
    error: state.provision.error.stringValue(),
    waiting: WaitingConstants.anyWaiting(state, Constants.waitingKey),
  }),
  dispatch => ({
    onOpenSettings: () => dispatch(ConfigGen.createOpenAppSettings()),
    onSubmitTextCode: (code: string) =>
      dispatch(ProvisionGen.createSubmitTextCode({phrase: new HiddenString(code)})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    error: stateProps.error,
    onOpenSettings: dispatchProps.onOpenSettings,
    onSubmitTextCode: dispatchProps.onSubmitTextCode,
    waiting: stateProps.waiting,
  }),
  'QRScan'
)(Container.safeSubmit(['onSubmitTextCode'], ['error'])(CodePage2))
