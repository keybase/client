import React from 'react'
import * as Styles from '../styles'
import {Props} from './switch-toggle'

const SwitchToggle = (props: Props) => (
  <div
    style={Styles.collapseStyles([
      styles.outer,
      props.on && {
        backgroundColor: Styles.globalColors[props.color],
        paddingLeft: enabledOffset,
      },
      props.style,
    ])}
  >
    <div style={styles.inner} />
  </div>
)

export default SwitchToggle

const disabledOffset = 2
const enabledOffset = 10
const styles = Styles.styleSheetCreate({
  inner: {
    backgroundColor: Styles.globalColors.white,
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  outer: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      backgroundColor: Styles.globalColors.greyDark,
      borderRadius: 8,
      flexShrink: 0,
      height: 16,
      paddingLeft: disabledOffset,
      transition: 'all 100ms ease-in-out',
      width: 24,
    },
  }),
})
