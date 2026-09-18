import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {useConfigState} from '@/stores/config'
import {useSettingsEmailState} from '@/stores/settings-email'
import {useSettingsPhoneState} from '@/stores/settings-phone'

export const loadSettings = () => {
  const f = async () => {
    if (!useConfigState.getState().loggedIn) {
      return
    }
    // Anything that writes these two stores while this RPC is in flight knows something the
    // reply does not, so the reply must not land on top of it. Apply each half only to the
    // value it was read against, the same rule the versioned session write follows. The
    // racing writer is usually an emailsChanged/phoneNumbersChanged notification, but it is
    // also resetState (a logout), notifyEmailVerified, and sentVerificationEmail -- so a
    // resend-verification click mid-load drops that round's server list too, by design.
    const emailsBefore = useSettingsEmailState.getState().emails
    const phonesBefore = useSettingsPhoneState.getState().phones
    try {
      const settings = await T.RPCGen.userLoadMySettingsRpcPromise(undefined, S.waitingKeySettingsLoadSettings)
      if (useSettingsEmailState.getState().emails === emailsBefore) {
        useSettingsEmailState.getState().dispatch.notifyEmailAddressEmailsChanged(settings.emails ?? [])
      }
      if (useSettingsPhoneState.getState().phones === phonesBefore) {
        useSettingsPhoneState.getState().dispatch.setNumbers(settings.phoneNumbers ?? undefined)
      }
    } catch (error) {
      if (!(error instanceof RPCError)) {
        return
      }
      logger.warn(`Error loading settings: ${error.message}`)
    }
  }
  ignorePromise(f())
}
