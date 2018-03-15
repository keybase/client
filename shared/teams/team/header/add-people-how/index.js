// @flow
import * as React from 'react'
import PopupMenu, {ModalLessPopupMenu} from '../../../../common-adapters/popup-menu'
import {isMobile} from '../../../../styles'

type Props = {
  onAddPeople: () => void,
  onClose: () => void,
  onInvite: () => void,
}

const AddPeopleHow = (props: Props) => {
  const items = [
    {title: 'By username', subTitle: 'Keybase, Twitter, etc.', onClick: props.onAddPeople},
    {title: isMobile ? 'From address book' : 'By email', onClick: props.onInvite, style: {borderTopWidth: 0}},
  ]

  return isMobile ? (
    <PopupMenu onHidden={props.onClose} style={{overflow: 'visible'}} items={items} />
  ) : (
    <ModalLessPopupMenu onHidden={() => {}} style={{overflow: 'visible', width: 200}} items={items} />
  )
}

export {AddPeopleHow}
