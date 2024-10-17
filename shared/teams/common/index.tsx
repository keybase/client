import * as React from 'react'
export {default as ParticipantMeta} from './meta'
export {default as Activity, useActivityLevels, ModalTitle} from './activity'
export {ChannelsWidget} from './channels-widget'
export {useAllChannelMetas, useChannelParticipants} from './channel-hooks'
export {default as SelectionPopup} from './selection-popup'
export {default as EnableContactsPopup} from './enable-contacts'
export {default as useTeamLinkPopup} from './use-team-link-popup'

export const usePhoneNumberList = () => {
  const [phoneNumbers, setPhoneNumbers] = React.useState([{key: 0, phoneNumber: '', valid: false}])
  const setPhoneNumber = (index: number, phoneNumber: string, valid: boolean) => {
    setPhoneNumbers(prev => prev.map((pn, i) => (i === index ? {...pn, phoneNumber, valid} : pn)))
  }
  const addPhoneNumber = () => {
    setPhoneNumbers(prev => [...prev, {key: (prev.at(-1)?.key ?? 0) + 1, phoneNumber: '', valid: false}])
  }
  const removePhoneNumber = (index: number) => {
    setPhoneNumbers(prev => prev.filter((_, i) => i !== index))
  }
  const resetPhoneNumbers = () => {
    setPhoneNumbers([{key: 0, phoneNumber: '', valid: false}])
  }

  return {addPhoneNumber, phoneNumbers, removePhoneNumber, resetPhoneNumbers, setPhoneNumber}
}
