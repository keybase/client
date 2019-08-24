import * as React from 'react'
import {FloatingMenu} from '../../../../common-adapters'
import {isMobile} from '../../../../styles'

type Props = {
  attachTo?: () => React.Component<any> | null
  visible: boolean
  onAddPeople: () => void
  onHidden: () => void
  onInvite: () => void
  onSlackImport: () => void
}

const AddPeopleHow = (props: Props) => {
  const items = [
    {onClick: props.onAddPeople, subTitle: 'Keybase, Twitter, etc.', title: 'By username'},
    {
      onClick: props.onInvite,
      style: {borderTopWidth: 0},
      subTitle: 'friends@friendships.com',
      title: isMobile ? 'From address book' : 'By email',
    },
    {
      onClick: props.onSlackImport,
      style: {borderTopWidth: 0},
      subTitle: 'New! Migrate your team',
      title: 'From Slack',
    },
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
