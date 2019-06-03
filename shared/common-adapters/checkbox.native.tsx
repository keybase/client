import React from 'react'
import {Props} from './checkbox'
import Switch from './switch'
import * as Styles from '../styles'

const Checkbox = (props: Props) => (
  <Switch
    align="left"
    color="blue"
    disabled={props.disabled}
    label={props.labelComponent || props.label || ''}
    on={props.checked}
    onClick={() => {
      props.onCheck && props.onCheck(!props.checked)
    }}
    style={Styles.collapseStyles([styles.container, props.style])}
  />
)

const styles = Styles.styleSheetCreate({
  container: {
    paddingBottom: Styles.globalMargins.xtiny,
    paddingTop: Styles.globalMargins.xtiny,
  },
})

export default Checkbox
