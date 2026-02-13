import * as C from '@/constants'
import {UpdatePassword} from '@/settings/password'
import {useState as useRecoverState} from '@/stores/recover-password'

const Password = () => {
  const error = useRecoverState(s => s.passwordError)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyRecoverPassword)
  const submitPassword = useRecoverState(s => s.dispatch.dynamic.submitPassword)
  const onSave = (p: string) => {
    submitPassword?.(p)
  }
  return <UpdatePassword error={error} hasRandomPW={false} onSave={onSave} waitingForResponse={waiting} />
}

export default Password
