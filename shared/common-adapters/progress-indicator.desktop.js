// @flow
import Icon from './icon'
import * as React from 'react'
import type {Props} from './progress-indicator'
import * as Styles from '../styles'

const ProgressIndicator = ({white, style, type}: Props) => (
  <Icon
    style={Styles.collapseStyles([type === 'Small' && styles.small, type === 'Large' && styles.large, style])}
    type={white ? 'icon-progress-white-animated' : 'icon-progress-grey-animated'}
  />
)

const styles = Styles.styleSheetCreate({
  large: {
    height: 32,
    width: 32,
  },
  small: {
    height: 24,
    width: 24,
  },
})

export default ProgressIndicator
