import * as React from 'react'
import {ReAnimated, ReAnimatedEasing} from './mobile.native'
import {globalColors, styleSheetCreate} from '../styles'
import {Props} from './loading-line'

const R = ReAnimated

// An alpha animation from 0 to 1 and back, 600ms on each side, goes forever
function runLoop() {
  const clock = new R.Clock()

  const state = {
    finished: new R.Value(0),
    frameTime: new R.Value(0),
    position: new R.Value(-1),
    time: new R.Value(0),
  }

  const config = {
    duration: new R.Value(600 * 2),
    easing: ReAnimatedEasing.inOut(ReAnimatedEasing.ease),
    toValue: new R.Value(1),
  }

  return R.block([
    R.startClock(clock),
    R.timing(clock, state, config),
    R.cond(state.finished, [
      R.stopClock(clock),
      // reset state
      R.set(state.finished, 0),
      R.set(state.frameTime, 0),
      R.set(state.position, -1),
      R.set(state.time, 0),

      // start clock again
      R.startClock(clock),
    ]),
    // Iterpolate alpha from 0 => 1 => 0 so it loops
    R.interpolate(state.position, {
      extrapolate: R.Extrapolate.CLAMP,
      inputRange: [-1, 0, 1],
      outputRange: [0, 1, 0],
    }),
  ])
}

class LoadingLine extends React.Component<Props> {
  _opacity = runLoop()

  render() {
    return <R.View style={[styles.line, {opacity: this._opacity}]} />
  }
}

const styles = styleSheetCreate({
  line: {
    backgroundColor: globalColors.blue,
    height: 1,
    position: 'absolute',
    width: '100%',
  },
})

export default LoadingLine
