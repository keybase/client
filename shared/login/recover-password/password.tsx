import * as C from '@/constants'
import {UpdatePassword} from '@/settings/password'
import {useState as useRecoverState} from '@/stores/recover-password'

type Props = {route: {params: {error?: string}}}

const Password = ({route}: Props) => {
  const {error} = route.params
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyRecoverPassword)
  const submitPassword = useRecoverState(s => s.dispatch.dynamic.submitPassword)
  const onSave = (p: string) => {
    submitPassword?.(p)
  }
  return <UpdatePassword error={error} onSave={onSave} waitingForResponse={waiting} />
}

export default Password
