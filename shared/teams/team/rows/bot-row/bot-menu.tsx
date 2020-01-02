import * as React from 'react'
import * as Kb from '../../../../common-adapters'

type Props = {
  attachTo?: () => React.Component<any> | null
  onEdit: () => void
  onRemove: () => void
  onHidden: () => void
  visible: boolean
}

const BotMenu = (props: Props) => {
  const items: Kb.MenuItems = [
    {icon: 'iconfont-gear', onClick: props.onEdit, title: 'Edit settings'},
    {danger: true, icon: 'iconfont-remove', onClick: props.onRemove, title: 'Uninstall'},
  ]
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
