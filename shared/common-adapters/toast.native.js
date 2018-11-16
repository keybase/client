// @flow
import * as React from 'react'
import FloatingBox from './floating-box'
import Box from './box'
import HOCTimers, {type PropsWithTimer} from './hoc-timers'
import {collapseStyles, globalColors, globalMargins, styleSheetCreate} from '../styles'
import {NativeAnimated, NativeEasing} from './native-wrappers.native'
import type {Props} from './toast'

type State = {
  opacity: NativeAnimated.Value,
  visible: boolean,
}
class _Toast extends React.Component<PropsWithTimer<Props>, State> {
  state = {opacity: new NativeAnimated.Value(0), visible: false}

  componentDidUpdate(prevProps: Props) {
    if (this.props.visible && !prevProps.visible) {
      this.setState({visible: true}, () =>
        NativeAnimated.timing(this.state.opacity, {
          duration: 100,
          easing: NativeEasing.linear,
          toValue: 1,
        }).start()
      )
    }
    if (!this.props.visible && prevProps.visible) {
      NativeAnimated.timing(this.state.opacity, {
        duration: 100,
        easing: NativeEasing.linear,
        toValue: 0,
      }).start()
      this.props.setTimeout(() => this.setState({visible: false}), 100)
    }
  }

  render() {
    if (!this.state.visible) {
      return null
    }
    return (
      <FloatingBox position={this.props.position}>
        <Box
          pointerEvents="none"
          style={collapseStyles([this.props.position === 'center center' && styles.wrapper])}
        >
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
const Toast = HOCTimers(_Toast)

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
