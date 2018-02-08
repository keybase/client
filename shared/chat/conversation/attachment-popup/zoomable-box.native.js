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

class PanZoomCalculator {
  initialTouch1: ?Touch = null
  touch1: ?Touch = null
  initialTouch2: ?Touch = null
  touch2: ?Touch = null

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

  updateTouch = (touch: Touch) => {
    if (this.initialTouch1 && this.initialTouch1.identifier === touch.identifier) {
      this.touch1 = touch
      return
    } else if (this.initialTouch2 && this.initialTouch2.identifier === touch.identifier) {
      this.touch2 = touch
      return
    }
    if (!this.touch2) {
      this.initialTouch2 = touch
      this.touch2 = touch
    }
  }

  panOffset = (): {x: number, y: number} => {
    let deltaX1: number = 0
    let deltaX2: number = 0
    let deltaY1: number = 0
    let deltaY2: number = 0
    if (this.touch1 && this.initialTouch1) {
      deltaX1 = this.touch1.pageX - this.initialTouch1.pageX
      deltaY1 = this.touch1.pageY - this.initialTouch1.pageY
    }
    if (this.touch2 && this.initialTouch2) {
      deltaX2 = this.touch2.pageX - this.initialTouch2.pageX
      deltaY2 = this.touch2.pageY - this.initialTouch2.pageY
    }
    if (this.touch1 && !this.touch2) {
      return {x: deltaX1, y: deltaY1}
    }
    if (this.touch1 && this.touch2) {
      return {x: (deltaX1 + deltaX2) / 2, y: (deltaY1 + deltaY2) / 2}
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
        for (const touch of evt.nativeEvent.changedTouches) {
          // $FlowIssue conversion from native type to our type
          this._panZoomCalculator.addTouch(touch)
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        // magic happens here
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

        for (const touch of evt.nativeEvent.changedTouches) {
          // $FlowIssue conversion from native type to our type
          this._panZoomCalculator.updateTouch(touch)
          const panOffset = this._panZoomCalculator.panOffset()
          this.setState({
            panOffset,
          })
        }
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
          left: this.state.pan.x + this.state.panOffset.x,
          top: this.state.pan.y + this.state.panOffset.y,
          transform: [
            {scale: this.state.scale},
            // {translateX: this.state.pan.x + this.state.panOffset.x},
            // {translateY: this.state.pan.y + this.state.panOffset.y},
          ],
        }}
      />
    )
  }
}

export {ZoomableBox}
