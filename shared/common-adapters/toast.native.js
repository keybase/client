// @flow
import * as React from 'react'
import FloatingBox from './floating-box'
import Box from './box'
import {collapseStyles, globalColors, globalMargins, styleSheetCreate} from '../styles'
import {NativeAnimated, NativeEasing} from './native-wrappers.native'
import type {Props} from './toast'

type State = {
  opacity: NativeAnimated.Value,
}
class Toast extends React.Component<Props, State> {
  state = {opacity: new NativeAnimated.Value(0)}

  componentDidUpdate(prevProps: Props) {
    if (this.props.visible && !prevProps.visible) {
      NativeAnimated.timing(this.state.opacity, {
        duration: 50,
        easing: NativeEasing.linear,
        toValue: 1,
      }).start()
    }
    if (!this.props.visible && prevProps.visible) {
      NativeAnimated.timing(this.state.opacity, {
        duration: 50,
        easing: NativeEasing.linear,
        toValue: 0,
      }).start()
    }
  }

  render() {
    return (
      <FloatingBox onHidden={() => {}}>
        <Box style={styles.wrapper}>
          <NativeAnimated.View
            style={collapseStyles([
              styles.container,
              this.props.containerStyle,
              {opacity: this.state.opacity},
            ])}
          >
            {this.props.children}
          </NativeAnimated.View>
        </Box>
      </FloatingBox>
    )
  }
}

const styles = styleSheetCreate({
  container: {
    alignItems: 'center',
    backgroundColor: globalColors.black_75,
    borderRadius: 70,
    borderWidth: 0,
    display: 'flex',
    justifyContent: 'center',
    margin: globalMargins.xtiny,
    paddingBottom: globalMargins.xtiny,
    paddingLeft: globalMargins.tiny,
    paddingRight: globalMargins.tiny,
    paddingTop: globalMargins.xtiny,
    width: 140,
    height: 140,
  },
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
})

export default Toast
