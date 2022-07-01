import * as Contacts from 'expo-contacts'
import * as Container from '../../util/container'
import * as React from 'react'
import * as SettingsConstants from '../../constants/settings'
import * as SettingsGen from '../../actions/settings-gen'
import {e164ToDisplay} from '../../util/phone-numbers'
import {NativeModules} from '../../util/native-modules.native'
import logger from '../../logger'

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
const strcmp = (a, b) => (a === b ? 0 : a > b ? 1 : -1)
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
    try {
      let defaultCountryCode = await NativeModules.Utils.getDefaultCountryCode()
      if (__DEV__ && !defaultCountryCode) {
        // behavior of parsing can be unexpectedly different with no country code.
        // iOS sim + android emu don't supply country codes, so use this one.
        defaultCountryCode = 'us'
      }
      region = defaultCountryCode
    } catch (error_) {
      const error = error_ as any
      logger.warn(`Error loading default country code: ${error.message}`)
    }
  }

  const mapped = contacts.data.reduce<Array<Contact>>((ret, contact) => {
    const {name = '', phoneNumbers = [], emails = []} = contact
    let pictureUri: string | undefined
    if (contact.imageAvailable && contact.image && contact.image.uri) {
      pictureUri = contact.image.uri
    }
    phoneNumbers.forEach(pn => {
      if (pn.number) {
        const value = SettingsConstants.getE164(pn.number, pn.countryCode || region)
        if (value) {
          const valueFormatted = e164ToDisplay(value)
          ret.push({id: pn.id, name, pictureUri, type: 'phone', value, valueFormatted})
        }
      }
    })
    emails.forEach(em => {
      if (em.email) {
        ret.push({id: em.id, name, pictureUri, type: 'email', value: em.email})
      }
    })
    return ret
  }, [])
  mapped.sort(compareContacts)
  return [mapped, region]
}

const useContacts = () => {
  const dispatch = Container.useDispatch()
  const [contacts, setContacts] = React.useState<Array<Contact>>([])
  const [region, setRegion] = React.useState('')
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [noAccessPermanent, setNoAccessPermanent] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  const permStatus = Container.useSelector(s => s.settings.contacts.permissionStatus)
  const savedRegion = Container.useSelector(s => s.settings.contacts.userCountryCode)

  React.useEffect(() => {
    if (permStatus === 'granted') {
      setNoAccessPermanent(false)
      fetchContacts(savedRegion || '').then(
        ([contacts, region]) => {
          setContacts(contacts)
          setRegion(region)
          setErrorMessage(null)
          setLoading(false)
        },
        err => {
          logger.warn('Error fetching contacts:', err)
          setErrorMessage(err.message)
          setLoading(false)
        }
      )
    } else if (permStatus === 'never_ask_again') {
      setErrorMessage('Keybase does not have permission to access your contacts.')
      setNoAccessPermanent(true)
      setLoading(false)
    }
  }, [dispatch, setErrorMessage, setContacts, permStatus, savedRegion])

  React.useEffect(() => {
    // Use a separate effect with limited amount of dependencies when deciding
    // whether to dispatch `createRequestContactPermissions` so we never
    // dispatch more than once.
    if (permStatus === 'unknown' || permStatus === 'undetermined') {
      setNoAccessPermanent(false)
      dispatch(SettingsGen.createRequestContactPermissions({thenToggleImportOn: false}))
    }
  }, [dispatch, permStatus])

  return {contacts, errorMessage, loading, noAccessPermanent, region}
}

export default useContacts
