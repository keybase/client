import Icon from './icon'
import * as React from 'react'
import {Props} from './progress-indicator'
import * as Styles from '../styles'

const ProgressIndicator = ({white, style, type}: Props) => (
  <Icon
    style={Styles.collapseStyles([type === 'Small' && styles.small, type === 'Large' && styles.large, style])}
    type={white ? 'icon-progress-white-animated' : 'icon-progress-grey-animated'}
  />
)

const styles = Styles.styleSheetCreate({
  large: {
    height: Styles.globalMargins.mediumLarge,
    width: Styles.globalMargins.mediumLarge,
  },
  small: {
    height: Styles.globalMargins.medium,
    width: Styles.globalMargins.medium,
  },
})

export default ProgressIndicator
