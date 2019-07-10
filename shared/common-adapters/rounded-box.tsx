import * as React from 'react'
import * as Styles from '../styles'
import {Box2} from './box'

const Kb = {
  Box2,
}

type Props = {
  children: React.ReactNode
  side?: 'bottom' | 'middle' | 'top'
}

const RoundedBox = (props: Props) => (
  <Kb.Box2
    direction="vertical"
    style={Styles.collapseStyles([
      styles.default,
      props.side === 'bottom' && styles.bottom,
      props.side === 'middle' && styles.middle,
      props.side === 'top' && styles.top,
    ])}
  >
    {props.children}
  </Kb.Box2>
)

const roundedBox: Styles.StylesCrossPlatform = {
  alignSelf: 'stretch',
  backgroundColor: Styles.globalColors.white,
  borderBottomWidth: 1,
  borderColor: Styles.globalColors.greyDark,
  borderLeftWidth: 1,
  borderRadius: Styles.borderRadius,
  borderRightWidth: 1,
  borderStyle: 'solid',
  borderTopWidth: 1,
  padding: Styles.globalMargins.small,
}

const styles = Styles.styleSheetCreate({
  bottom: {
    ...roundedBox,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
  },
  default: {
    ...roundedBox,
  },
  middle: {
    ...roundedBox,
    borderRadius: 0,
    borderTopWidth: 0,
  },
  top: {
    ...roundedBox,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
})

export default RoundedBox
