import * as C from '@/constants'
import {useProvisionState} from '@/stores/provision'

const useQR = () => {
  const submitTextCode = useProvisionState(s => s.dispatch.dynamic.submitTextCode)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyProvision)
  const onSubmitTextCode = (c: string) => submitTextCode?.(c)
  return {
    onSubmitTextCode,
    waiting,
  }
}
export default useQR
