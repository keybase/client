import * as React from 'react'
import {Box2} from './box'
import * as Styles from '../styles'

const Squeeze = (props: {children?: React.ReactNode; enable: boolean}) =>
  props.enable ? (
    <Box2
      direction="vertical"
      fullWidth={true}
      fullHeight={true}
      centerChildren={true}
      alignItems="center"
      style={styles.container}
    >
      {props.children}
    </Box2>
  ) : (
    <>{props.children}</>
  )

const styles = Styles.styleSheetCreate(() => ({
  container: {
    // set maxWidth to roughly the width of the largest phone that looks ok.
    // The largest iphone at the time was 416 wide (measured in 1x pixels).
    // The major factor is button's maxWidth
    maxWidth: 460,
  },
}))

export default Squeeze
