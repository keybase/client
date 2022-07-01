import * as React from 'react'
import {NativeTouchableWithoutFeedback} from '../native-wrappers.native'
import {Box, Box2} from '../box'
import FloatingBox from '../floating-box'
import {Props} from '.'
import * as Styles from '../../styles'

const Overlay = (props: Props) => {
  if (Object.prototype.hasOwnProperty.call(props, 'visible') && !props.visible) {
    return null
  }
  return (
    <FloatingBox onHidden={() => {}} dest={props.dest} hideKeyboard={true}>
      <Box2
        direction="vertical"
        style={Styles.collapseStyles([styles.container, !!props.color && {color: props.color}])}
      >
        <NativeTouchableWithoutFeedback onPress={props.onHidden}>
          {/* This has to be a `Box` so `TouchableWithoutFeedback`'s touch responders get piped through to the `View` */}
          <Box style={styles.touchArea} />
        </NativeTouchableWithoutFeedback>
        {props.children}
      </Box2>
    </FloatingBox>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.fillAbsolute,
    alignItems: 'stretch',
    backgroundColor: Styles.globalColors.black_50OrBlack_60,
    justifyContent: 'flex-end',
  },
  touchArea: {
    ...Styles.globalStyles.fillAbsolute,
  },
}))

export default Overlay
