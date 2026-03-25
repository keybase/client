import * as React from 'react'
import * as C from '@/constants'
import {usePushState} from '@/stores/push'
import {useSettingsPhoneState} from '@/stores/settings-phone'
import {useSignupState} from '@/stores/signup'

const useFinishSignup = () => {
  const showPushPrompt = usePushState(s => C.isMobile && !s.hasPermissions && s.showPushPrompt)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)

  return React.useCallback(() => {
    showPushPrompt ? navigateAppend('settingsPushPrompt', true) : clearModals()
  }, [showPushPrompt, navigateAppend, clearModals])
}

export const useCompleteSignupWithEmail = () => {
  const finishSignup = useFinishSignup()
  const setJustSignedUpEmail = useSignupState(s => s.dispatch.setJustSignedUpEmail)

  return React.useCallback(
    (email: string) => {
      setJustSignedUpEmail(email)
      finishSignup()
    },
    [setJustSignedUpEmail, finishSignup]
  )
}

export const useSkipSignupEmail = () => {
  const completeSignupWithEmail = useCompleteSignupWithEmail()

  return React.useCallback(() => {
    completeSignupWithEmail(C.noEmail)
  }, [completeSignupWithEmail])
}

export const useNavigateToSignupEmail = () => {
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const clearPhoneNumberAdd = useSettingsPhoneState(s => s.dispatch.clearPhoneNumberAdd)

  return React.useCallback(() => {
    clearPhoneNumberAdd()
    navigateAppend('signupEnterEmail', true)
  }, [clearPhoneNumberAdd, navigateAppend])
}
