import * as Contacts from 'expo-contacts'
import * as React from 'react'
import {e164ToDisplay} from '@/util/phone-numbers'
import logger from '@/logger'
import * as Localization from 'expo-localization'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import {getE164} from '@/util/phone-numbers'

// Contact info coming from the native contacts library.
export type Contact = {
  id: string // unique per-contact ID
  name: string
  pictureUri?: string
  type: 'phone' | 'email'
  value: string
  valueFormatted?: string
}

// for sorting
const strcmp = (a: string, b: string) => (a === b ? 0 : a > b ? 1 : -1)
const compareContacts = (a: Contact, b: Contact): number => {
  if (a.name === b.name) {
    return strcmp(a.value, b.value)
  }
  return strcmp(a.name, b.name)
}

const fetchContacts = async (regionFromState: string): Promise<[Array<Contact>, string]> => {
  const contacts = await Contacts.getContactsAsync({
    fields: [
      Contacts.Fields.Name,
      Contacts.Fields.PhoneNumbers,
      Contacts.Fields.Emails,
      Contacts.Fields.ImageAvailable,
      Contacts.Fields.Image,
    ],
  })

  let region = ''
  if (regionFromState) {
    logger.debug(`Got region from state: ${regionFromState}, no need to call NativeModules.`)
    region = regionFromState
  } else {
    {
      let defaultCountryCode = Localization.getLocales()[0].regionCode?.toLowerCase() ?? ''
      if (__DEV__ && !defaultCountryCode) {
        // behavior of parsing can be unexpectedly different with no country code.
        // iOS sim + android emu don't supply country codes, so use this one.
        defaultCountryCode = 'us'
      }
      region = defaultCountryCode
    }
  }

  const mapped = contacts.data.reduce<Array<Contact>>((ret, contact) => {
    const {name = '', phoneNumbers = [], emails = []} = contact
    let pictureUri: string | undefined
    if (contact.imageAvailable && contact.image?.uri) {
      pictureUri = contact.image.uri
    }
    phoneNumbers.forEach(pn => {
      if (pn.number && pn.id) {
        const value = getE164(pn.number, pn.countryCode || region)
        if (value) {
          const valueFormatted = e164ToDisplay(value)
          ret.push({id: pn.id, name, pictureUri, type: 'phone', value, valueFormatted})
        }
      }
    })
    emails.forEach(em => {
      if (em.email && em.id) {
        ret.push({id: em.id, name, pictureUri, type: 'email', value: em.email})
      }
    })
    return ret
  }, [])
  mapped.sort(compareContacts)
  return [mapped, region]
}

type ContactsLoadState =
  | {contacts: Array<Contact>; errorMessage?: undefined; key: string; region: string}
  | {contacts?: undefined; errorMessage: string; key: string; region?: undefined}

const useContacts = () => {
  const [loadState, setLoadState] = React.useState<ContactsLoadState | undefined>()

  const permStatus = useSettingsContactsState(s => s.permissionStatus)
  const savedRegion = useSettingsContactsState(s => s.userCountryCode)
  const contactsKey = permStatus === 'granted' ? savedRegion || '' : undefined

  React.useEffect(() => {
    if (contactsKey === undefined) {
      return
    }
    let canceled = false
    fetchContacts(contactsKey)
      .then(
        ([contacts, region]) => {
          if (!canceled) {
            setLoadState({contacts, key: contactsKey, region})
          }
        },
        (_err: unknown) => {
          const err = _err as {message: string}
          logger.warn('Error fetching contacts:', err)
          if (!canceled) {
            setLoadState({errorMessage: err.message, key: contactsKey})
          }
        }
      )
      .catch(() => {})
    return () => {
      canceled = true
    }
  }, [contactsKey])

  const requestPermissions = useSettingsContactsState(s => s.dispatch.requestPermissions)
  React.useEffect(() => {
    // Use a separate effect with limited amount of dependencies when deciding
    // whether to dispatch `createRequestContactPermissions` so we never
    // dispatch more than once.
    if (permStatus === 'unknown' || permStatus === 'undetermined') {
      requestPermissions(false)
    }
  }, [requestPermissions, permStatus])

  const visibleLoadState = loadState?.key === contactsKey ? loadState : undefined
  const noAccessPermanent = permStatus === 'denied'
  const errorMessage = noAccessPermanent
    ? 'Keybase does not have permission to access your contacts.'
    : visibleLoadState?.errorMessage
  const loading = permStatus === 'granted' ? !visibleLoadState : !noAccessPermanent
  const contacts = visibleLoadState?.contacts ?? []
  const region = visibleLoadState?.region ?? ''

  return {contacts, errorMessage, loading, noAccessPermanent, region}
}

export default useContacts
