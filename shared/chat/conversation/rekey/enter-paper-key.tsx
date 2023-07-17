import {PaperKey} from '../../../provision/paper-key'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

export default () => {
  const error = ''
  const hint = ''
  const waiting = false
  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }

  const checkPaperKeyRPC = Container.useRPC(RPCTypes.loginPaperKeySubmitRpcPromise)
  const onSubmit = (paperKey: string) => {
    checkPaperKeyRPC(
      [{paperPhrase: paperKey}],
      () => {},
      () => {}
    )
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(RouteTreeGen.createNavigateUp())
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
