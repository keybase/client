import Animation from './animation'
import * as React from 'react'
import type {Props} from './progress-indicator'
import * as Styles from '../styles'

const Kb = {
  Animation,
}

const ProgressIndicator = React.memo(function ProgressIndicator({white, style, type}: Props) {
  return (
    <Kb.Animation
      animationType={white ? 'spinnerWhite' : 'spinner'}
      style={Styles.collapseStyles([
        type === 'Small' && styles.small,
        type === 'Large' && styles.large,
        type === 'Huge' && styles.huge,
        style,
      ])}
    />
  )
})

const styles = Styles.styleSheetCreate(() => ({
  huge: {
    height: Styles.globalMargins.xlarge,
    width: Styles.globalMargins.xlarge,
  },
  large: {
    height: Styles.globalMargins.mediumLarge,
    width: Styles.globalMargins.mediumLarge,
  },
  small: {
    height: Styles.globalMargins.medium,
    width: Styles.globalMargins.medium,
  },
}))

export default ProgressIndicator
