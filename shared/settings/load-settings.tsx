import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useSettingsEmailState} from '@/stores/settings-email'
import {useSettingsPhoneState} from '@/stores/settings-phone'

export const loadSettings = () => {
  const f = async () => {
    if (!useConfigState.getState().loggedIn) {
      return
    }
    // Anything that writes these two stores while this RPC is in flight knows something the
    // reply does not, so the reply must not land on top of it. Apply each half only to the
    // value it was read against. The racing writer is usually an emailsChanged/phoneNumbersChanged notification, but
    // notifyEmailVerified and sentVerificationEmail trip it too -- so a resend-verification
    // click mid-load drops that round's server list, by design.
    const emailsBefore = useSettingsEmailState.getState().emails
    const phonesBefore = useSettingsPhoneState.getState().phones
    const uidBefore = useCurrentUserState.getState().uid
    try {
      const settings = await T.RPCGen.userLoadMySettingsRpcPromise(undefined, S.waitingKeySettingsLoadSettings)
      // A logout does NOT trip the identity checks below: Z.defaultReset restores the values
      // captured at store creation, so on a cold start emails is the same initial Map and
      // phones the same undefined. Without this, the reply would repopulate the stores for a
      // logged-out app and the next account could read the previous one's settings.
      if (!useConfigState.getState().loggedIn) {
        return
      }
      // An account switch is invisible to both checks above: the reset restores the same
      // creation-time values the reference checks compare against, and the new account is
      // logged in by the time the reply lands. Only the uid separates account A's reply from
      // account B's stores -- and writing it would also make B's own in-flight load look
      // raced, so B would be left showing A's emails and phone numbers.
      if (useCurrentUserState.getState().uid !== uidBefore) {
        return
      }
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
