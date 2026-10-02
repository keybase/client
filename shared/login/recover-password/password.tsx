import * as C from '@/constants'
import {UpdatePassword} from '@/settings/password'
import {submitRecoverPasswordPassword} from './flow'
import {useRecoverPromptBack} from './use-prompt-back'

type Props = {route: {params: {error?: string; promptId: number}}}

const Password = ({route}: Props) => {
  const {error, promptId} = route.params
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyRecoverPassword)
  useRecoverPromptBack(promptId)
  const onSave = (p: string) => {
    submitRecoverPasswordPassword(promptId, p)
  }
  return <UpdatePassword error={error ?? ''} onSave={onSave} waitingForResponse={waiting} />
}

export default Password
