import * as Container from '../../../util/container'
import * as RecoverPasswordGen from '../../../actions/recover-password-gen'
import PaperKey from '.'

type OwnProps = {}

const ConnectedPaperKey = Container.connect(
  state => ({
    error: state.recoverPassword.paperKeyError.stringValue(),
  }),
  dispatch => ({
    onBack: () => dispatch(RecoverPasswordGen.createAbortPaperKey()),
    onSubmit: (paperKey: string) => dispatch(RecoverPasswordGen.createSubmitPaperKey({paperKey})),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(PaperKey)

export default ConnectedPaperKey
