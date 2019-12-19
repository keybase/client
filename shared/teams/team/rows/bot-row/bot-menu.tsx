import * as React from 'react'
import * as Kb from '../../../../common-adapters'

type Props = {
  attachTo?: () => React.Component<any> | null
  onHidden: () => void
  visible: boolean
}

const items: Kb.MenuItems = [
  {icon: 'iconfont-gear', onClick: () => null, title: 'Edit settings'},
  {danger: true, icon: 'iconfont-remove', onClick: () => null, title: 'Uninstall'},
]

const BotMenu = (props: Props) => {
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
