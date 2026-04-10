import * as Contacts from 'expo-contacts'
import * as Localization from 'expo-localization'
import logger from '@/logger'
import * as T from '@/constants/types'
import {addNotificationRequest} from 'react-native-kb'
import {getE164} from '@/util/phone-numbers'
import {pluralize} from '@/util/string'

export const getDefaultCountryCode = () => {
  let defaultCountryCode = Localization.getLocales()[0].regionCode?.toLowerCase() ?? ''
  if (__DEV__ && !defaultCountryCode) {
    // behavior of parsing can be unexpectedly different with no country code.
    // iOS sim + android emu don't supply country codes, so use this one.
    defaultCountryCode = 'us'
  }
  return defaultCountryCode
}

const nativeContactsToContacts = (contacts: Contacts.ContactResponse, countryCode: string) =>
  contacts.data.reduce<Array<T.RPCGen.Contact>>((ret, contact) => {
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

export const clearContactList = () => T.RPCGen.contactsSaveContactListRpcPromise({contacts: []})

export const syncContactsToServer = async () => {
  const contacts = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
  })
  const defaultCountryCode = getDefaultCountryCode()
  const mapped = nativeContactsToContacts(contacts, defaultCountryCode)
  logger.info(`Importing ${mapped.length} contacts.`)
  const {newlyResolved = [], resolved = []} = await T.RPCGen.contactsSaveContactListRpcPromise({
    contacts: mapped,
  })
  if (newlyResolved.length) {
    addNotificationRequest({
      body: makeContactsResolvedMessage(newlyResolved),
      id: Math.floor(Math.random() * 2 ** 32).toString(),
    }).catch(() => {})
  }
  return {
    defaultCountryCode,
    importedCount: mapped.length,
    newlyResolved,
    resolved,
  }
}
