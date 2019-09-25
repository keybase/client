import * as Container from '../../../util/container'
import * as RecoverPasswordGen from '../../../actions/recover-password-gen'
import PromptReset from '.'

type OwnProps = {}

const ConnectedPromptReset = Container.connect(
  _ => ({}),
  dispatch => ({
    onContinue: (action: boolean) => dispatch(RecoverPasswordGen.createSubmitResetPrompt({action})),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(PromptReset)

export default ConnectedPromptReset
