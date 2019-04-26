// @flow
import * as React from 'react'
import {ReAnimated, ReAnimatedEasing} from './mobile.native'
import {globalColors, styleSheetCreate} from '../styles'
import type {Props} from './loading-line'

const R = ReAnimated

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
    // start right away
    R.startClock(clock),

    // process your state
    R.timing(clock, state, config),

    // when over (processed by timing at the end)
    R.cond(state.finished, [
      // we stop
      R.stopClock(clock),

      // set flag ready to be restarted
      R.set(state.finished, 0),
      // same value as the initial defined in the state creation
      R.set(state.position, -1),

      // very important to reset this ones !!! as mentioned in the doc about timing is saying
      R.set(state.time, 0),
      R.set(state.frameTime, 0),

      // and we restart
      R.startClock(clock),
    ]),
    // state.position,
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
    position: 'relative',
    width: '100%',
  },
})

export default LoadingLine
