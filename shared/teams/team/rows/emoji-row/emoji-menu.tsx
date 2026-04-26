import type * as React from 'react'
import * as Kb from '@/common-adapters'

type Props = {
  attachTo?: React.RefObject<Kb.MeasureRef | null> | undefined
  onAddAlias?: (() => void) | undefined
  onRemove?: (() => void) | undefined
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
      {...(props.attachTo === undefined ? {} : {attachTo: props.attachTo})}
      closeOnSelect={true}
      items={items}
      onHidden={props.onHidden}
      visible={props.visible}
    />
  )
}

export default EmojiMenu
