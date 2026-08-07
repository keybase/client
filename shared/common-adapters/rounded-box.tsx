import type * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from './box'

const Kb = {
  Box2,
}

type Props = {
  children: React.ReactNode
  side?: 'bottom' | 'middle' | 'top'
  style?: Styles.StylesCrossPlatform
}

const RoundedBox = (props: Props) => {
  const styles = useStyles()
  return (
    <Kb.Box2
      direction="vertical"
      alignSelf="stretch"
      padding="small"
      style={Styles.collapseStyles([
        styles.default,
        props.side === 'bottom' && styles.bottom,
        props.side === 'middle' && styles.middle,
        props.side === 'top' && styles.top,
        props.style,
      ])}
    >
      {props.children}
    </Kb.Box2>
  )
}

const useStyles = Styles.createStyleHook(theme => {
  const roundedBox: Styles.StylesCrossPlatform = {
    backgroundColor: theme.white,
    borderBottomWidth: 1,
    borderColor: theme.greyDark,
    borderLeftWidth: 1,
    borderRadius: Styles.borderRadius,
    borderRightWidth: 1,
    borderStyle: 'solid',
    borderTopWidth: 1,
  }

  return {
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
  }
})

export default RoundedBox
