import * as Tabs from '@/constants/tabs'
import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import logger from '@/logger'
import {navigateAppend, switchTab} from '@/constants/router'
import {RPCError} from '@/util/errors'
import {useConfigState} from '@/stores/config'
import {useSettingsEmailState} from '@/stores/settings-email'
import {useSettingsPhoneState} from '@/stores/settings-phone'

let maybeLoadAppLinkOnce = false

export const loadSettings = () => {
  const maybeLoadAppLink = () => {
    const phones = useSettingsPhoneState.getState().phones
    if (!phones || phones.size > 0) {
      return
    }

    if (maybeLoadAppLinkOnce || !useConfigState.getState().startup.link.endsWith('/phone-app')) {
      return
    }
    maybeLoadAppLinkOnce = true
    switchTab(Tabs.settingsTab)
    navigateAppend({name: 'settingsAddPhone', params: {}})
  }

  const f = async () => {
    if (!useConfigState.getState().loggedIn) {
      return
    }
    try {
      const settings = await T.RPCGen.userLoadMySettingsRpcPromise(undefined, S.waitingKeySettingsLoadSettings)
      useSettingsEmailState.getState().dispatch.notifyEmailAddressEmailsChanged(settings.emails ?? [])
      useSettingsPhoneState.getState().dispatch.setNumbers(settings.phoneNumbers ?? undefined)
      maybeLoadAppLink()
    } catch (error) {
      if (!(error instanceof RPCError)) {
        return
      }
      logger.warn(`Error loading settings: ${error.message}`)
    }
  }
  ignorePromise(f())
}
