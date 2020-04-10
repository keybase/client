import * as React from 'react'
import * as Kb from '../../../../common-adapters'

type Props = {
  attachTo?: () => React.Component<any> | null
  onAddAlias?: () => void
  onRemove?: () => void
  onHidden: () => void
  visible: boolean
  isAlias: boolean
}

const EmojiMenu = (props: Props) => {
  const items: Kb.MenuItems = [
    ...(props.onAddAlias
      ? [
          {
            onClick: props.onAddAlias,
            title: 'Add alias',
          },
        ]
      : []),
    ...(props.onRemove
      ? [
          {
            danger: true,
            icon: 'iconfont-remove',
            onClick: props.onRemove,
            title: props.isAlias ? 'Delete alias' : 'Delete emoji',
          } as const,
        ]
      : []),
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

export default EmojiMenu
