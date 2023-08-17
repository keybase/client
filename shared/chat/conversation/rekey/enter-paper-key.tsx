import {PaperKey} from '../../../provision/paper-key'
import * as T from '../../../constants/types'
import * as Container from '../../../util/container'
import * as C from '../../../constants'

export default () => {
  const error = ''
  const hint = ''
  const waiting = false
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }

  const checkPaperKeyRPC = Container.useRPC(T.RPCGen.loginPaperKeySubmitRpcPromise)
  const onSubmit = (paperKey: string) => {
    checkPaperKeyRPC(
      [{paperPhrase: paperKey}],
      () => {},
      () => {}
    )
    navigateUp()
    navigateUp()
  }
  const props = {
    error,
    hint,
    onBack,
    onSubmit,
    waiting,
  }
  return <PaperKey {...props} />
}
