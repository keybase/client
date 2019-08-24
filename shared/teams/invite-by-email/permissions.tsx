import {ContactProps} from './index'
import * as Contacts from 'react-native-contacts'
import {isAndroid} from '../../constants/platform'

export type ContactsResult = {
  hasPermission: boolean
  contacts?: Array<ContactProps>
}

export const getAndroidContacts: () => Promise<ContactsResult> = () =>
  new Promise((resolve, reject) => {
    Contacts.checkPermission((err, permission) => {
      // Check the existing system settings, see if we need to ask
      if (err) {
        reject(err)
      }
      if (permission === 'undefined' || permission === 'denied') {
        // Now we need to show the request dialog
        Contacts.requestPermission((err, _) => {
          // second param is supposed to be granted, but is buggy, so we checkPermission again
          if (err) {
            reject(err)
          }
          Contacts.checkPermission((err, permission) => {
            // Check to see what the user said
            if (err) {
              reject(err)
            }
            if (permission === 'authorized') {
              Contacts.getAll((err, contacts) => {
                if (err) {
                  reject(err)
                } else {
                  resolve({contacts, hasPermission: true})
                }
              })
            } else {
              // If not authorized, then we tried and they said no.
              reject(Error('unauthorized'))
            }
          })
        })
      } else if (permission === 'authorized') {
        // If we're already authorized, go ahead and fetch contacts
        Contacts.getAll((err, contacts) => {
          if (err) {
            reject(err)
          } else {
            resolve({contacts, hasPermission: true})
          }
        })
      } else {
        reject(err)
      }
    })
  })

export const getiOSContacts: () => Promise<ContactsResult> = () =>
  new Promise((resolve, reject) => {
    Contacts.getAll((err, contacts) => {
      if (err) {
        reject(err)
      } else {
        resolve({contacts, hasPermission: true})
      }
    })
  })

export const getContacts: () => Promise<ContactsResult> = () => {
  if (isAndroid) {
    return getAndroidContacts()
  }
  return getiOSContacts()
}
