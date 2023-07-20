import {PaperKey} from '../../../provision/paper-key'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import * as Container from '../../../util/container'
import * as RouterConstants from '../../../constants/router2'

export default () => {
  const error = ''
  const hint = ''
  const waiting = false
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }

  const checkPaperKeyRPC = Container.useRPC(RPCTypes.loginPaperKeySubmitRpcPromise)
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
