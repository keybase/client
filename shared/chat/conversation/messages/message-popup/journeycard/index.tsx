import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import type {Position, StylesCrossPlatform} from '../../../../../styles'

type Props = {
  attachTo?: () => React.Component<any> | null
  onDismiss: () => void
  onHidden: () => void
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

const JourneycardPopupMenu = (props: Props) => {
  const items: Kb.MenuItems = [
    {icon: 'iconfont-close', onClick: props.onDismiss, title: 'Dismiss message'},
  ].reduce<Kb.MenuItems>((arr, i) => {
    i && arr.push(i as Kb.MenuItem)
    return arr
  }, [])

  return (
    <Kb.FloatingMenu
      attachTo={props.attachTo}
      closeOnSelect={true}
      items={items}
      onHidden={props.onHidden}
      position={props.position}
      positionFallbacks={[]}
      containerStyle={props.style}
      visible={props.visible}
      safeProviderStyle={safeProviderStyle}
    />
  )
}

const safeProviderStyle = {flex: 1} as const

export default JourneycardPopupMenu
