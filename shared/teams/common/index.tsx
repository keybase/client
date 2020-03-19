import * as React from 'react'
export {default as ParticipantMeta} from './meta'
export {default as Activity, ModalTitle} from './activity'

export const usePhoneNumberList = () => {
  const [phoneNumbers, setPhoneNumbers] = React.useState([{key: 0, phoneNumber: '', valid: false}])
  const setPhoneNumber = (i: number, phoneNumber: string, valid: boolean) => {
    const pn = phoneNumbers[i]
    if (pn) {
      pn.phoneNumber = phoneNumber
      pn.valid = valid
      setPhoneNumbers([...phoneNumbers])
    }
  }
  const addPhoneNumber = () => {
    phoneNumbers.push({key: phoneNumbers[phoneNumbers.length - 1].key + 1, phoneNumber: '', valid: false})
    setPhoneNumbers([...phoneNumbers])
  }
  const removePhoneNumber = (i: number) => {
    phoneNumbers.splice(i, 1)
    setPhoneNumbers([...phoneNumbers])
  }

  return {addPhoneNumber, phoneNumbers, removePhoneNumber, setPhoneNumber}
}
