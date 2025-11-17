import * as C from '@/constants'

const useQR = () => {
  const submitTextCode = C.useProvisionState(s => s.dispatch.dynamic.submitTextCode)
  const waiting = C.Waiting.useAnyWaiting(C.Provision.waitingKey)
  const onSubmitTextCode = (c: string) => submitTextCode?.(c)
  return {
    onSubmitTextCode,
    waiting,
  }
}
export default useQR
