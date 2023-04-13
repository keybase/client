import * as React from 'react'
export {default as ParticipantMeta} from './meta'
export {default as Activity, useActivityLevels, ModalTitle} from './activity'
export {ChannelsWidget} from './channels-widget'
export {useChannelMeta, useAllChannelMetas, useChannelParticipants} from './channel-hooks'
export {default as SelectionPopup} from './selection-popup'
export {default as EnableContactsPopup} from './enable-contacts'
export {default as useTeamLinkPopup} from './use-team-link-popup'

export const usePhoneNumberList = () => {
  const [phoneNumbers, setPhoneNumbers] = React.useState([{key: 0, phoneNumber: '', valid: false}])
  /**
   * @param index of the element in `phoneNumbers` to set
   * @param phoneNumber from `Kb.PhoneInput#onChangeNumber`
   * @param valid from `Kb.PhoneInput#onChangeNumber`
   */
  const setPhoneNumber = (index: number, phoneNumber: string, valid: boolean) => {
    const pn = phoneNumbers[index]
    if (pn) {
      pn.phoneNumber = phoneNumber
      pn.valid = valid
      setPhoneNumbers([...phoneNumbers])
    }
  }
  /**
   * Push a phone number to the list.
   */
  const addPhoneNumber = () => {
    phoneNumbers.push({key: phoneNumbers[phoneNumbers.length - 1].key + 1, phoneNumber: '', valid: false})
    setPhoneNumbers([...phoneNumbers])
  }
  /**
   * Remove a phone number from the list. Should not be used to clear the last phone number, use `reset` in that case.
   * @param index of the element in `phoneNumbers` to remove.
   */
  const removePhoneNumber = (index: number) => {
    phoneNumbers.splice(index, 1)
    setPhoneNumbers([...phoneNumbers])
  }
  /**
   * Reset the list to contain one empty phone number.
   */
  const resetPhoneNumbers = () => {
    setPhoneNumbers([
      {key: (phoneNumbers[phoneNumbers.length - 1]?.key ?? -1) + 1, phoneNumber: '', valid: false},
    ])
  }

  return {addPhoneNumber, phoneNumbers, removePhoneNumber, resetPhoneNumbers, setPhoneNumber}
}
