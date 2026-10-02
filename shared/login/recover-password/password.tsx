import * as C from '@/constants'
import * as React from 'react'
import {getVisibleScreen, navigateUp} from '@/constants/router'
import {UpdatePassword} from '@/settings/password'
import {isRecoverPasswordPromptGone, submitRecoverPasswordPassword} from './flow'
import {useRecoverPromptBack} from './use-prompt-back'

type Props = {route: {params: {error?: string; promptId: number}}}

const Password = ({route}: Props) => {
  const {error, promptId} = route.params
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyRecoverPassword)
  useRecoverPromptBack(promptId)

  // A deferred push can land after its prompt was settled; there is nothing left to answer. Effects
  // also re-run after Save (a screen unfreezing, a hot reload), when the screen must stay. A covered
  // screen stays: removing a covered modal crashes iOS.
  React.useEffect(() => {
    if (!isRecoverPasswordPromptGone(promptId)) return
    const visible = getVisibleScreen(true)
    if (
      visible?.name === 'recoverPasswordSetPassword' &&
      (visible.params as {promptId?: number} | undefined)?.promptId === promptId
    ) {
      navigateUp()
    }
  }, [promptId])

  const onSave = (p: string) => {
    submitRecoverPasswordPassword(promptId, p)
  }
  return <UpdatePassword error={error ?? ''} onSave={onSave} waitingForResponse={waiting} />
}

export default Password
