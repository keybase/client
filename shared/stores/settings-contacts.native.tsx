import * as Contacts from 'expo-contacts'
import {ignorePromise} from '@/constants/utils'
import {importContactsWaitingKey} from '@/constants/strings'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import {addNotificationRequest} from 'react-native-kb'
import logger from '@/logger'
import type {Store, State} from './settings-contacts'
import {RPCError} from '@/util/errors'
import {getDefaultCountryCode} from 'react-native-kb'
import {getE164} from '@/util/phone-numbers'
import {pluralize} from '@/util/string'
import {navigateAppend} from '@/constants/router2'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useWaitingState} from '@/stores/waiting'

const importContactsConfigKey = (username: string) => `ui.importContacts.${username}`

const initialStore: Store = {
  alreadyOnKeybase: [],
  importError: '',
  importPromptDismissed: false,
  importedCount: undefined,
  permissionStatus: 'unknown',
  userCountryCode: undefined,
  waitingToShowJoinedModal: false,
}

const nativeContactsToContacts = (contacts: Contacts.ContactResponse, countryCode: string) => {
  return contacts.data.reduce<Array<T.RPCGen.Contact>>((ret, contact) => {
    const {name, phoneNumbers = [], emails = []} = contact

    const components = phoneNumbers.reduce<T.RPCGen.ContactComponent[]>((res, pn) => {
      const formatted = getE164(pn.number || '', pn.countryCode || countryCode)
      if (formatted) {
        res.push({
          label: pn.label,
          phoneNumber: formatted,
        })
      }
      return res
    }, [])
    components.push(...emails.map(e => ({email: e.email, label: e.label})))
    if (components.length) {
      ret.push({components, name})
    }

    return ret
  }, [])
}

// When the notif is tapped we are only passed the message, use this as a marker
// so we can handle it correctly.
const contactNotifMarker = 'Your contact'
const makeContactsResolvedMessage = (cts: T.Immutable<Array<T.RPCGen.ProcessedContact>>) => {
  if (cts.length === 0) {
    return ''
  }
  switch (cts.length) {
    case 1:
      return `${contactNotifMarker} ${cts[0]?.contactName ?? ''} joined Keybase!`
    case 2:
      return `${contactNotifMarker}s ${cts[0]?.contactName ?? ''} and ${
        cts[1]?.contactName ?? ''
      } joined Keybase!`
    default: {
      const lenMinusTwo = cts.length - 2
      return `${contactNotifMarker}s ${cts[0]?.contactName ?? ''}, ${
        cts[1]?.contactName ?? ''
      }, and ${lenMinusTwo} ${pluralize('other', lenMinusTwo)} joined Keybase!`
    }
  }
}

export const useSettingsContactsState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    editContactImportEnabled: (enable, fromSettings) => {
      if (fromSettings) {
        set(s => {
          s.waitingToShowJoinedModal = true
        })
      }
      const f = async () => {
        const username = useCurrentUserState.getState().username
        if (!username) {
          logger.warn('no username')
          return
        }
        await T.RPCGen.configGuiSetValueRpcPromise(
          {path: importContactsConfigKey(username), value: {b: enable, isNull: false}},
          importContactsWaitingKey
        )
        get().dispatch.loadContactImportEnabled()
      }
      ignorePromise(f())
    },
    importContactsLater: () => {
      set(s => {
        s.importPromptDismissed = true
      })
    },
    loadContactImportEnabled: () => {
      const f = async () => {
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
        get().dispatch.loadContactPermissions()
        get().dispatch.manageContactsCache()
      }
      ignorePromise(f())
    },
    loadContactPermissions: () => {
      const f = async () => {
        const {status} = await Contacts.getPermissionsAsync()
        logger.info(`OS status: ${status}`)

        set(s => {
          s.permissionStatus = status
        })
      }
      ignorePromise(f())
    },
    manageContactsCache: () => {
      const f = async () => {
        if (get().importEnabled === false) {
          await T.RPCGen.contactsSaveContactListRpcPromise({contacts: []})
          set(s => {
            s.importedCount = undefined
            s.importError = ''
          })
          return
        }

        // get permissions if we haven't loaded them for some reason
        let {permissionStatus} = get()
        if (permissionStatus === 'unknown') {
          permissionStatus = (await Contacts.getPermissionsAsync()).status
        }
        const perm = permissionStatus === 'granted'

        const enabled = get().importEnabled
        if (!enabled || !perm) {
          if (enabled && !perm) {
            logger.info('contact import enabled but no contact permissions')
          }
          if (enabled === undefined) {
            logger.info("haven't loaded contact import enabled")
          }
          return
        }

        // feature enabled and permission granted
        let mapped: T.RPCChat.Keybase1.Contact[]
        let defaultCountryCode = ''
        try {
          const _contacts = await Contacts.getContactsAsync({
            fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
          })

          try {
            defaultCountryCode = await getDefaultCountryCode()
            if (__DEV__ && !defaultCountryCode) {
              // behavior of parsing can be unexpectedly different with no country code.
              // iOS sim + android emu don't supply country codes, so use this one.
              defaultCountryCode = 'us'
            }
          } catch (error) {
            logger.warn(`Error loading default country code: ${String(error)}`)
          }
          mapped = nativeContactsToContacts(_contacts, defaultCountryCode)
        } catch (_error) {
          const error = _error as {message: string}
          logger.error(`error loading contacts: ${error.message}`)
          set(s => {
            s.importedCount = undefined
            s.importError = error.message
          })
          return
        }
        logger.info(`Importing ${mapped.length} contacts.`)
        try {
          const {newlyResolved, resolved} = await T.RPCGen.contactsSaveContactListRpcPromise({
            contacts: mapped,
          })
          logger.info(`Success`)
          set(s => {
            s.importedCount = mapped.length
            s.importError = ''
          })
          set(s => {
            s.userCountryCode = defaultCountryCode
          })
          if (newlyResolved?.length) {
            addNotificationRequest({
              body: makeContactsResolvedMessage(newlyResolved),
              id: Math.floor(Math.random() * 2 ** 32).toString(),
            }).catch(() => {})
          }
          if (get().waitingToShowJoinedModal && resolved) {
            set(s => {
              s.alreadyOnKeybase = T.castDraft(resolved)
              s.waitingToShowJoinedModal = false
            })
            if (resolved.length) {
              navigateAppend('settingsContactsJoined')
            }
          }
        } catch (_error) {
          const error = _error as {message: string}
          logger.error('Error saving contacts list: ', error.message)
          set(s => {
            s.importedCount = undefined
            s.importError = error.message
          })
        }
      }
      ignorePromise(f())
    },
    requestPermissions: (thenToggleImportOn?: boolean, fromSettings?: boolean) => {
      const f = async () => {
        const {decrement, increment} = useWaitingState.getState().dispatch
        increment(importContactsWaitingKey)
        const status = (await Contacts.requestPermissionsAsync()).status

        if (status === Contacts.PermissionStatus.GRANTED && thenToggleImportOn) {
          get().dispatch.editContactImportEnabled(true, fromSettings)
        }
        set(s => {
          s.permissionStatus = status
        })
        decrement(importContactsWaitingKey)
      }
      ignorePromise(f())
    },
    resetState: 'default',
  }
  return {
    ...initialStore,
    dispatch,
  }
})
