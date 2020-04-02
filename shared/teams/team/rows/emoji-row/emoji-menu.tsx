import * as React from 'react'
import * as Kb from '../../../../common-adapters'

type Props = {
  attachTo?: () => React.Component<any> | null
  canManageEmoji: boolean
  onEditAlias: () => void
  onAddAlias: () => void
  onRemove: () => void
  onHidden: () => void
  visible: boolean
}

const EmojiMenu = (props: Props) => {
  const items: Kb.MenuItems = [
    {
      onClick: props.onEditAlias,
      title: 'Edit alias',
    },
    {
      onClick: props.onAddAlias,
      title: 'Add alias',
    },
  ]
  if (props.canManageEmoji) {
    items.push({danger: true, icon: 'iconfont-remove', onClick: props.onRemove, title: 'Delete emoji'})
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

export default EmojiMenu
