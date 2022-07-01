import * as React from 'react'
import * as Kb from '../../../../common-adapters'

type Props = {
  attachTo?: () => React.Component<any> | null
  canManageBots: boolean
  onEdit: () => void
  onRemove: () => void
  onHidden: () => void
  visible: boolean
}

const BotMenu = (props: Props) => {
  const items: Kb.MenuItems = [
    {
      icon: 'iconfont-gear',
      onClick: props.onEdit,
      title: !props.canManageBots ? 'View settings' : 'Edit settings',
    },
  ]
  if (props.canManageBots) {
    items.push({danger: true, icon: 'iconfont-remove', onClick: props.onRemove, title: 'Uninstall'})
  }
  return (
    <Kb.FloatingMenu
      attachTo={props.attachTo}
      closeOnSelect={true}
      items={items}
      onHidden={props.onHidden}
      visible={props.visible}
    />
  )
}

export default BotMenu
