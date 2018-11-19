// @flow
import {type ContactProps} from './index'
import * as Contacts from 'react-native-contacts'
import {isAndroid} from '../../constants/platform'

export type ContactsResult = {
  contacts?: Array<ContactProps>,
}

export const getAndroidContacts: () => Promise<ContactsResult> = () =>
  new Promise((resolve, reject) => {
    Contacts.checkPermission((err, permission) => {
      // Check the existing system settings, see if we need to ask
      if (err) {
        reject(err)
      }
      if (permission === 'undefined' || permission === 'denied') {
        reject(err)
      } else if (permission === 'authorized') {
        // If we're already authorized, go ahead and fetch contacts
        Contacts.getAll((err, contacts) => {
          if (err) {
            reject(err)
          } else {
            resolve({contacts})
          }
        })
      } else {
        reject(new Error(`Unknown contact permission result: ${permission}`))
      }
    })
  })

export const getiOSContacts: () => Promise<ContactsResult> = () =>
  new Promise((resolve, reject) => {
    Contacts.getAll((err, contacts) => {
      if (err) {
        reject(err)
      } else {
        resolve({contacts})
      }
    })
  })

export const getContacts: () => Promise<ContactsResult> = () => {
  if (isAndroid) {
    return getAndroidContacts()
  }
  return getiOSContacts()
}
