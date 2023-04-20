import * as Container from '../../../util/container'
import * as RecoverPasswordGen from '../../../actions/recover-password-gen'
import HiddenString from '../../../util/hidden-string'
import PaperKey from '.'

const ConnectedPaperKey = () => {
  const error = Container.useSelector(state => state.recoverPassword.paperKeyError.stringValue())
  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(RecoverPasswordGen.createAbortPaperKey())
  }
  const onSubmit = (paperKey: string) => {
    dispatch(RecoverPasswordGen.createSubmitPaperKey({paperKey: new HiddenString(paperKey)}))
  }
  const props = {error, onBack, onSubmit}
  return <PaperKey {...props} />
}

export default ConnectedPaperKey
