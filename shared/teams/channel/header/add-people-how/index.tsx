import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {
  attachTo?: () => React.Component<any> | null
  visible: boolean
  onAddPeople: () => void
  onHidden: () => void
  onInvite: () => void
  onSlackImport: () => void
}

const AddPeopleHow = (props: Props) => {
  const items: Kb.MenuItems = [
    {
      icon: 'iconfont-mention',
      onClick: props.onAddPeople,
      subTitle: 'Keybase, Twitter, etc.',
      title: 'By username',
    },
    {
      icon: 'iconfont-contact-card',
      onClick: props.onInvite,
      style: {borderTopWidth: 0},
      subTitle: 'friends@friendships.com',
      title: Styles.isMobile ? 'From address book' : 'By email',
    },
    {
      icon: 'iconfont-hash',
      onClick: props.onSlackImport,
      style: {borderTopWidth: 0},
      subTitle: 'New! Migrate your team',
      title: 'From Slack',
    },
  ]

  return (
    <Kb.FloatingMenu
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
