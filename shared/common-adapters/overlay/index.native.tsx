import {TouchableWithoutFeedback} from 'react-native'
import {Box, Box2} from '../box'
import FloatingBox from '../floating-box'
import type {Props} from '.'
import * as Styles from '../../styles'

const Kb = {
  Box,
  Box2,
  FloatingBox,
}

const Overlay = (props: Props) => {
  if (Object.prototype.hasOwnProperty.call(props, 'visible') && !props.visible) {
    return null
  }
  return (
    <Kb.FloatingBox onHidden={() => {}} hideKeyboard={true}>
      <Kb.Box2
        direction="vertical"
        style={Styles.collapseStyles([styles.container, !!props.color && {color: props.color}])}
      >
        <TouchableWithoutFeedback onPress={props.onHidden}>
          {/* This has to be a `Box` so `TouchableWithoutFeedback`'s touch responders get piped through to the `View` */}
          <Kb.Box style={styles.touchArea} />
        </TouchableWithoutFeedback>
        {props.children}
      </Kb.Box2>
    </Kb.FloatingBox>
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
