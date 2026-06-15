import * as C from '@/constants'
import {submitProvisionTextCode} from '../../flow'

const useQR = () => {
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyProvision)
  return {
    onSubmitTextCode: submitProvisionTextCode,
    waiting,
  }
}
export default useQR
