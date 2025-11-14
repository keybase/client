import * as C from '@/constants'
import {UpdatePassword} from '@/settings/password'

const Password = () => {
  const error = C.useRecoverState(s => s.passwordError)
  const waiting = C.Waiting.useAnyWaiting(C.RecoverPwd.waitingKey)
  const submitPassword = C.useRecoverState(s => s.dispatch.dynamic.submitPassword)
  const onSave = (p: string) => {
    submitPassword?.(p)
  }
  return <UpdatePassword error={error} hasRandomPW={false} onSave={onSave} waitingForResponse={waiting} />
}

export default Password
