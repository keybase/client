// @flow
import * as React from 'react'
import {Text} from '../../../../common-adapters'
import PopupMenu, {ModalLessPopupMenu} from '../../../../common-adapters/popup-menu'
import {isMobile} from '../../../../styles'

type Props = {
  label: string,
  onClose: () => void,
}

const AddPeopleHow = (props: Props) => {
  const items = [{title: 'thing', view: <Text type="BodySemibold">Hi!</Text>}]

  return isMobile ? (
    <PopupMenu onHidden={props.onClose} style={{overflow: 'visible'}} items={items} />
  ) : (
    <ModalLessPopupMenu onHidden={() => {}} style={{overflow: 'visible', width: 200}} items={items} />
  )
}

export {AddPeopleHow}
