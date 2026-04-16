import * as Contacts from 'expo-contacts'
import {importContactsWaitingKey} from '@/constants/strings'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import logger from '@/logger'
import type {Store, State} from './settings-contacts'
import {RPCError} from '@/util/errors'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useWaitingState} from '@/stores/waiting'

const importContactsConfigKey = (username: string) => `ui.importContacts.${username}`

const initialStore: Store = {
  permissionStatus: 'unknown',
  syncGeneration: 0,
  userCountryCode: undefined,
}

export const useSettingsContactsState = Z.createZustand<State>('settings-contacts', (set, get) => {
  const dispatch: State['dispatch'] = {
    editContactImportEnabled: async enable => {
      const username = useCurrentUserState.getState().username
      if (!username) {
        logger.warn('no username')
        return
      }
      await T.RPCGen.configGuiSetValueRpcPromise(
        {path: importContactsConfigKey(username), value: {b: enable, isNull: false}},
        importContactsWaitingKey
      )
      await get().dispatch.loadContactImportEnabled()
    },
    loadContactImportEnabled: async () => {
      if (!useConfigState.getState().loggedIn) {
        return
      }
      const username = useCurrentUserState.getState().username
      if (!username) {
        logger.warn('no username')
        return
      }
      let enabled = false
      try {
        const value = await T.RPCGen.configGuiGetValueRpcPromise(
          {path: importContactsConfigKey(username)},
          importContactsWaitingKey
        )
        enabled = !!value.b && !value.isNull
      } catch (error) {
        if (!(error instanceof RPCError)) {
          return
        }
        if (!error.message.includes('no such key')) {
          logger.error(`Error reading config: ${error.message}`)
        }
      }

      set(s => {
        s.importEnabled = enabled
      })
      await get().dispatch.loadContactPermissions()
    },
    loadContactPermissions: async () => {
      const {status} = await Contacts.getPermissionsAsync()
      logger.info(`OS status: ${status}`)
      set(s => {
        s.permissionStatus = status
      })
      return status
    },
    notifySyncSucceeded: userCountryCode => {
      set(s => {
        s.syncGeneration++
        if (userCountryCode) {
          s.userCountryCode = userCountryCode
        }
      })
    },
    requestPermissions: async () => {
      const {decrement, increment} = useWaitingState.getState().dispatch
      increment(importContactsWaitingKey)
      try {
        const status = (await Contacts.requestPermissionsAsync()).status
        set(s => {
          s.permissionStatus = status
        })
        return status
      } finally {
        decrement(importContactsWaitingKey)
      }
    },
    resetState: Z.defaultReset,
  }
  return {
    ...initialStore,
    dispatch,
  }
})
