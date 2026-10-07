import {PaperKey} from '@/provision/paper-key'
import * as T from '@/constants/types'
import * as C from '@/constants'

const EnterPaperKey = () => {
  const navigateUp = C.Router2.navigateUp
  const checkPaperKeyRPC = C.useRPC(T.RPCGen.loginPaperKeySubmitRpcPromise)
  const onSubmit = (paperKey: string) => {
    checkPaperKeyRPC(
      [{paperPhrase: paperKey}],
      () => {},
      () => {}
    )
    navigateUp()
    navigateUp()
  }
  return <PaperKey onSubmit={onSubmit} error="" hint="" waiting={false} />
}
export default EnterPaperKey
