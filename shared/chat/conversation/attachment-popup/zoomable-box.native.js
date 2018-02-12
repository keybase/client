// @flow
import * as React from 'react'
import {Box, NativePanResponder} from '../../../common-adapters/index.native'
import clamp from 'lodash/clamp'

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

  _scaleOffset: number = 1

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
    this._scaleOffset = 1
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

  distance = (a: Touch, b: Touch): number => {
    return Math.sqrt(Math.pow(a.pageX - b.pageX, 2) + Math.pow(a.pageY - b.pageY, 2))
  }

  scaleOffset = (): number => {
    if (this.touch1 && this.initialTouch1 && this.touch2 && this.initialTouch2) {
      const initialDistance = this.distance(this.initialTouch1, this.initialTouch2)
      // $FlowFixMe flow loses the refinement
      const currentDistance = this.distance(this.touch1, this.touch2)
      this._scaleOffset = currentDistance / initialDistance
    }
    return this._scaleOffset
  }
}

// TODO react `View` props
export type Props = {
  maxZoom: number,
  style?: any,
}

type State = {
  layoutHeight: number,
  layoutWidth: number,
  pan: {x: number, y: number},
  panOffset: {x: number, y: number},
  scale: number,
  scaleOffset: number,
  translateX: number,
  translateY: number,
}

class ZoomableBox extends React.Component<Props, State> {
  static defaultProps = {
    maxZoom: 3,
  }
  _panResponder: NativePanResponder
  _panZoomCalculator: PanZoomCalculator = new PanZoomCalculator()
  state = {
    layoutHeight: 0,
    layoutWidth: 0,
    pan: {x: 0, y: 0},
    panOffset: {x: 0, y: 0},
    scale: 1,
    scaleOffset: 1,
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
        this._panZoomCalculator.updateTouches(evt.nativeEvent.touches)
        this._panZoomCalculator.updateGestureState(gestureState)
      },
      onPanResponderMove: (evt, gestureState) => {
        this._panZoomCalculator.updateTouches(evt.nativeEvent.touches)
        this._panZoomCalculator.updateGestureState(gestureState)
        const panOffset = this._panZoomCalculator.panOffset()
        const scaleOffset = this._panZoomCalculator.scaleOffset()
        this.setState({
          panOffset,
          scaleOffset,
        })
      },
      onPanResponderRelease: (evt, gestureState) => {
        this.setState({
          pan: {
            x: this.panX(),
            y: this.panY(),
          },
          panOffset: {
            x: 0,
            y: 0,
          },
          scale: this.scale(),
          scaleOffset: 1,
        })
        this._panZoomCalculator.releaseTouches()
        this._panZoomCalculator.releaseGestureState()
      },
    })
  }

  _onLayout = evt => {
    this.setState({
      layoutHeight: evt.nativeEvent.layout.height,
      layoutWidth: evt.nativeEvent.layout.width,
    })
  }

  scale = () => clamp(this.state.scale * this.state.scaleOffset, 1, this.props.maxZoom)
  panX = () =>
    clamp(
      this.state.pan.x + this.state.panOffset.x,
      (1 - this.scale()) * this.state.layoutWidth / 2,
      (this.scale() - 1) * this.state.layoutWidth / 2
    )
  panY = () =>
    clamp(
      this.state.pan.y + this.state.panOffset.y,
      (1 - this.scale()) * this.state.layoutHeight / 2,
      (this.scale() - 1) * this.state.layoutHeight / 2
    )

  render() {
    return (
      <Box
        {...this.props}
        {...this._panResponder.panHandlers}
        onLayout={this._onLayout}
        style={{
          ...this.props.style,
          position: 'absolute',
          transform: [
            {scale: this.scale()},
            {translateX: this.panX() / this.scale()},
            {translateY: this.panY() / this.scale()},
          ],
        }}
      />
    )
  }
}

export {ZoomableBox}
