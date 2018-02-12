// @flow
import * as React from 'react'
import {Box, NativePanResponder} from '../../../common-adapters/index.native'

type Touch = {
  identifier: number,
  locationX: number,
  locationY: number,
  pageX: number,
  pageY: number,
}

type GestureState = {
  stateID: number,
  moveX: number,
  moveY: number,
  x0: number,
  y0: number,
  dx: number,
  dy: number,
  vx: number,
  vy: number,
  numberActiveTouches: number,
}

class PanZoomCalculator {
  initialTouch1: ?Touch = null
  touch1: ?Touch = null
  initialTouch2: ?Touch = null
  touch2: ?Touch = null
  gestureState: ?GestureState = null

  addTouch = (touch: Touch) => {
    if (this.touch1 === null) {
      this.initialTouch1 = touch
      this.touch1 = touch
    } else if (this.touch2 === null) {
      this.initialTouch2 = touch
      this.touch2 = touch
    }
  }

  releaseTouches = () => {
    this.initialTouch1 = null
    this.touch1 = null
    this.initialTouch2 = null
    this.touch2 = null
  }

  // TODO fix this
  updateTouches = (touches: Touch[]) => {
    for (const touch of touches) {
      if (this.initialTouch1 && this.initialTouch1.identifier === touch.identifier) {
        this.touch1 = touch
      } else if (this.initialTouch2 && this.initialTouch2.identifier === touch.identifier) {
        this.touch2 = touch
      } else if (!this.initialTouch1) {
        this.initialTouch1 = touch
        this.touch1 = touch
      } else if (!this.initialTouch2) {
        this.initialTouch2 = touch
        this.touch2 = touch
      }
    }
    if (touches.length < 2) {
      this.touch2 = null
      this.initialTouch2 = null
    }
    if (touches.length < 1) {
      this.touch1 = null
      this.initialTouch1 = null
    }
  }

  updateGestureState = (gestureState: GestureState) => {
    this.gestureState = gestureState
  }

  releaseGestureState = () => {
    this.gestureState = null
  }

  panOffset = (): {x: number, y: number} => {
    if (this.gestureState) {
      return {x: this.gestureState.dx, y: this.gestureState.dy}
    }
    return {x: 0, y: 0}
  }
}

// TODO react `View` props
export type Props = any

type State = {
  currentGesture: ?number,
  scale: number,
  pan: {x: number, y: number},
  panOffset: {x: number, y: number},
  translateX: number,
  translateY: number,
}

class ZoomableBox extends React.Component<Props, State> {
  _panResponder: NativePanResponder
  _panZoomCalculator: PanZoomCalculator = new PanZoomCalculator()
  state = {
    currentGesture: null,
    scale: 2,
    pan: {x: 0, y: 0},
    panOffset: {x: 0, y: 0},
    translateX: 0,
    translateY: 0,
  }

  componentWillMount() {
    this._panResponder = NativePanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        // $FlowIssue conversion from native type to our type
        this._panZoomCalculator.updateTouches(evt.nativeEvent.touches)
        this._panZoomCalculator.updateGestureState(gestureState)
      },
      onPanResponderMove: (evt, gestureState) => {
        // magic happens here
        console.log(evt, gestureState)
        // console.log(
        //   JSON.stringify(
        //     evt.nativeEvent.touches,
        //     [
        //       'identifier',
        //       'locationX',
        //       'locationY',
        //       'pageX',
        //       'pageY',
        //       'target',
        //       'timestamp',
        //       0,
        //       1,
        //       2,
        //       3,
        //       4,
        //       5,
        //     ],
        //     2
        //   )
        // )

        // $FlowIssue conversion from native type to our type
        this._panZoomCalculator.updateTouches(evt.nativeEvent.touches)
        this._panZoomCalculator.updateGestureState(gestureState)
        const panOffset = this._panZoomCalculator.panOffset()
        this.setState({
          panOffset,
        })
      },
      onPanResponderRelease: (evt, gestureState) => {
        this.setState({
          pan: {
            x: this.state.pan.x + this.state.panOffset.x,
            y: this.state.pan.y + this.state.panOffset.y,
          },
          panOffset: {
            x: 0,
            y: 0,
          },
        })
        this._panZoomCalculator.releaseTouches()
        this._panZoomCalculator.releaseGestureState()
      },
    })
  }

  render() {
    return (
      <Box
        {...this.props}
        {...this._panResponder.panHandlers}
        style={{
          ...this.props.style,
          position: 'absolute',
          transform: [
            {scale: this.state.scale},
            {translateX: (this.state.pan.x + this.state.panOffset.x) / this.state.scale},
            {translateY: (this.state.pan.y + this.state.panOffset.y) / this.state.scale},
          ],
        }}
      />
    )
  }
}

export {ZoomableBox}
