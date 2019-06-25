import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {Position} from '../../common-adapters/relative-popup-hoc.types'
import MenuLayout, {MenuItems} from '../../common-adapters/floating-menu/menu-layout'

export type Props = {
  closeOnSelect: boolean
  closeText?: string | null // mobile only; default to "Close",
  containerStyle?: Styles.StylesCrossPlatform
  items: MenuItems
  onHidden: () => void
  visible: boolean
  attachTo?: () => React.Component<any> | null
  position?: Position
  positionFallbacks?: Position[]
  propagateOutsideClicks?: boolean
}

export default (props: Props) => {
  if (!props.visible) {
    return null
  }

  const [filter, onChangeFilter] = React.useState('')
  return (
    <Kb.Overlay
      position={props.position}
      positionFallbacks={props.positionFallbacks}
      onHidden={props.onHidden}
      visible={props.visible}
      attachTo={props.attachTo}
      style={props.containerStyle}
      propagateOutsideClicks={props.propagateOutsideClicks}
    >
      <Kb.NewInput
        autoFocus={true}
        containerStyle={styles.input}
        placeholder="Search"
        icon="iconfont-search"
        onChangeText={onChangeFilter}
        textType="BodySemibold"
      />
      <MenuLayout
        onHidden={props.onHidden}
        items={props.items.filter(item => {
          if (typeof item !== 'object') {
            return false
          }
          return item.title.toLowerCase().includes(filter.toLowerCase())
        })}
        closeOnClick={props.closeOnSelect}
        closeText={props.closeText}
        style={styles.menuLayout}
        listStyle={styles.listStyle}
      />
    </Kb.Overlay>
  )
}

const styles = Styles.styleSheetCreate({
  input: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.flexBoxRow,
      flexShrink: 0,
      height: 38,
      width: '100%',
    },
  }),
  listStyle: Styles.platformStyles({
    isElectron: {
      paddingBottom: 0,
      paddingTop: 0,
    },
  }),
  menuLayout: {
    maxHeight: 160,
    overflowX: 'hidden',
    overflowY: 'auto',
  },
})
