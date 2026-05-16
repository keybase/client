import * as C from '@/constants'
import {UpdatePassword} from '@/settings/password'
import {submitRecoverPasswordPassword} from './flow'

type Props = {route: {params: {error?: string}}}

const Password = ({route}: Props) => {
  const {error} = route.params
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyRecoverPassword)
  const onSave = (p: string) => {
    submitRecoverPasswordPassword(p)
  }
  return <UpdatePassword error={error ?? ''} onSave={onSave} waitingForResponse={waiting} />
}

export default Password
