import * as C from '@/constants'
import {UpdatePassword} from '@/settings/password'
import {submitRecoverPasswordPassword} from './flow'
import {useRecoverPromptBack, useRecoverPromptSelfClose} from './use-prompt-back'

// runId: the run that showed it, which takes its own screens away when it fails
type Props = {route: {params: {error?: string; promptId: number; runId: number}}}

const Password = ({route}: Props) => {
  const {error, promptId} = route.params
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyRecoverPassword)
  useRecoverPromptBack(promptId)
  useRecoverPromptSelfClose(promptId, 'recoverPasswordSetPassword')

  const onSave = (p: string) => {
    submitRecoverPasswordPassword(promptId, p)
  }
  return <UpdatePassword error={error ?? ''} onSave={onSave} waitingForResponse={waiting} />
}

export default Password
