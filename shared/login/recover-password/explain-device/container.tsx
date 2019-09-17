import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as RecoverPasswordGen from '../../../actions/recover-password-gen'
import ExplainDevice from '.'

type OwnProps = {}

const ConnectedExplainDevice = Container.connect(
  state => {
    const ed = state.recoverPassword.explainedDevice
    return {
      deviceName: ed ? ed.name : '',
      deviceType: ed ? ed.type : undefined,
      username: state.recoverPassword.username,
    }
  },
  dispatch => ({
    onBack: () => dispatch(RecoverPasswordGen.createRestartRecovery()),
    onComplete: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (s, d, o: OwnProps) => ({
    ...o,
    ...s,
    ...d,
  })
)(ExplainDevice)

export default ConnectedExplainDevice
