import * as React from 'react'
import * as Styles from '../styles'
import {ImageSourcePropType, View, Animated} from 'react-native'
import {
  PanGestureHandler,
  PinchGestureHandler,
  RotationGestureHandler,
  State,
} from 'react-native-gesture-handler'

type Props = {
  source: ImageSourcePropType
  style?: Styles.StylesCrossPlatform
}

class ZoomableBox extends React.Component<Props> {
  panRef = React.createRef()
  rotationRef = React.createRef()
  pinchRef = React.createRef()
  constructor(props) {
    super(props)

    /* Pinching */
    this._baseScale = new Animated.Value(1)
    this._pinchScale = new Animated.Value(1)
    this._scale = Animated.multiply(this._baseScale, this._pinchScale)
    this._lastScale = 1
    this._onPinchGestureEvent = Animated.event([{nativeEvent: {scale: this._pinchScale}}], {
      useNativeDriver: true,
    })

    /* Rotation */
    this._rotate = new Animated.Value(0)
    this._rotateStr = this._rotate.interpolate({
      inputRange: [-100, 100],
      outputRange: ['-100rad', '100rad'],
    })
    this._lastRotate = 0
    this._onRotateGestureEvent = Animated.event([{nativeEvent: {rotation: this._rotate}}], {
      useNativeDriver: true,
    })

    /* Pan */
    this._panX = new Animated.Value(0)
    this._panY = new Animated.Value(0)
    // this._panStr = this._pan.interpolate({
    // inputRange: [-501, -500, 0, 1],
    // outputRange: ['1rad', '1rad', '0rad', '0rad'],
    // })
    this._lastPanX = 0
    this._lastPanY = 0
    this._onPanGestureEvent = Animated.event(
      [{nativeEvent: {translationX: this._panX, translationY: this._panY}}],
      {
        useNativeDriver: true,
      }
    )
  }

  _onRotateHandlerStateChange = event => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      this._lastRotate += event.nativeEvent.rotation
      this._rotate.setOffset(this._lastRotate)
      this._rotate.setValue(0)
    }
  }
  _onPinchHandlerStateChange = event => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      this._lastScale *= event.nativeEvent.scale
      this._baseScale.setValue(this._lastScale)
      this._pinchScale.setValue(1)
    }
  }
  _onPanGestureStateChange = event => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      this._lastPanX += event.nativeEvent.translationX
      this._lastPanY += event.nativeEvent.translationY
      this._panX.setOffset(this._lastPanX)
      this._panX.setValue(0)
      this._panY.setOffset(this._lastPanY)
      this._panY.setValue(0)
    }
  }
  render() {
    return (
      <PanGestureHandler
        ref={this.panRef}
        onGestureEvent={this._onPanGestureEvent}
        onHandlerStateChange={this._onPanGestureStateChange}
        minDist={1}
        minPointers={1}
        maxPointers={1}
      >
        <Animated.View style={styles.wrapper}>
          <RotationGestureHandler
            ref={this.rotationRef}
            simultaneousHandlers={this.pinchRef}
            onGestureEvent={this._onRotateGestureEvent}
            onHandlerStateChange={this._onRotateHandlerStateChange}
          >
            <Animated.View style={styles.wrapper}>
              <PinchGestureHandler
                ref={this.pinchRef}
                simultaneousHandlers={this.rotationRef}
                onGestureEvent={this._onPinchGestureEvent}
                onHandlerStateChange={this._onPinchHandlerStateChange}
              >
                <Animated.View style={styles.container} collapsable={false}>
                  <Animated.Image
                    style={[
                      styles.pinchableImage,
                      {
                        transform: [
                          {translateX: this._panX},
                          {translateY: this._panY},
                          {perspective: 200},
                          {scale: this._scale},
                          {rotate: this._rotateStr},
                        ],
                      },
                    ]}
                    source={this.props.source}
                  />
                </Animated.View>
              </PinchGestureHandler>
            </Animated.View>
          </RotationGestureHandler>
        </Animated.View>
      </PanGestureHandler>
    )
  }
}

// const styles = StyleSheet.create({
// container: {
// ...StyleSheet.absoluteFillObject,
// backgroundColor: 'black',
// overflow: 'hidden',
// alignItems: 'center',
// flex: 1,
// justifyContent: 'center',
// },
// pinchableImage: {
// width: 250,
// height: 250,
// },
// wrapper: {
// flex: 1,
// },
// })

// class ZoomableBox extends React.Component<Props> {
// private baseScale = new Animated.Value(1)
// private pinchScale = new Animated.Value(1)
// private scale = Animated.multiply(this.baseScale, this.pinchScale)
// private lastScale = 1
// private onPinchGestureEvent = Animated.event([{nativeEvent: {scale: this.pinchScale}}], {
// useNativeDriver: true,
// })

// private onPinchHandlerStateChange = event => {
// if (event.nativeEvent.oldState === State.ACTIVE) {
// this.lastScale *= event.nativeEvent.scale
// this.baseScale.setValue(this.lastScale)
// this.pinchScale.setValue(1)
// }
// }

// render() {
// return (
// <PinchGestureHandler
// onGestureEvent={this.onPinchGestureEvent}
// onHandlerStateChange={this.onPinchHandlerStateChange}
// >
// <Animated.View
// style={Styles.collapseStyles([styles.container, this.props.style])}
// collapsable={false}
// >
// <Animated.Image
// source={this.props.source}
// style={[styles.pinchableImage, {transform: [{perspective: 200}, {scale: this.scale}]}]}
// />
// </Animated.View>
// </PinchGestureHandler>
// )
// }
// }

const styles = Styles.styleSheetCreate({
  container: {
    alignItems: 'center',
    backgroundColor: 'black',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pinchableImage: {
    height: Styles.dimensionHeight,
    width: Styles.dimensionWidth,
  },
  wrapper: {flex: 1},
})

export default ZoomableBox
