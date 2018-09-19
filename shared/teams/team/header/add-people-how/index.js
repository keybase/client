// @flow
import * as React from 'react'
import {FloatingMenu} from '../../../../common-adapters'
import {isMobile} from '../../../../styles'

type Props = {
  attachTo: ?() => ?React.ElementRef<any>,
  visible: boolean,
  onAddPeople: () => void,
  onHidden: () => void,
  onInvite: () => void,
}

const AddPeopleHow = (props: Props) => {
  const items = [
    {title: 'By username', subTitle: 'Keybase, Twitter, etc.', onClick: props.onAddPeople},
    {title: isMobile ? 'From address book' : 'By email', onClick: props.onInvite, style: {borderTopWidth: 0}},
  ]

  return (
    <FloatingMenu
      attachTo={props.attachTo}
      visible={props.visible}
      items={items}
      onHidden={props.onHidden}
      position="bottom left"
      closeOnSelect={true}
    />
  )
}

export {AddPeopleHow}
