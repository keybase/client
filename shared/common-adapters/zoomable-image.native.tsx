import * as React from 'react'
import * as Styles from '../styles'
import {LayoutChangeEvent, View, ImageSourcePropType, Animated, Image} from 'react-native'
import {
  // eslint-disable-next-line
  PanGestureHandlerStateChangeEvent,
  // eslint-disable-next-line
  PinchGestureHandlerStateChangeEvent,
  // eslint-disable-next-line
  RotationGestureHandlerStateChangeEvent,
  PanGestureHandler,
  PinchGestureHandler,
  RotationGestureHandler,
  State,
} from 'react-native-gesture-handler'

type Props = {
  onLoad?: () => void
  uri: string
  style?: Styles.StylesCrossPlatform
}

class ZoomableBox extends React.Component<Props, {height: number; width: number}> {
  state = {
    height: 0,
    width: 0,
  }

  private containerHeight = 0
  private containerWidth = 0
  private mounted = true
  private panRef = React.createRef<PanGestureHandler>()
  private rotationRef = React.createRef<RotationGestureHandler>()
  private pinchRef = React.createRef<PinchGestureHandler>()
  private baseScale = new Animated.Value(1)
  private pinchScale = new Animated.Value(1)
  private opacity = new Animated.Value(0)
  private scale = Animated.multiply(this.baseScale, this.pinchScale)
  private lastScale = 1
  private onPinchGestureEvent = Animated.event([{nativeEvent: {scale: this.pinchScale}}], {
    useNativeDriver: true,
  })

  private rotate = new Animated.Value(0)
  private rotateStr = this.rotate.interpolate({
    inputRange: [-100, 100],
    outputRange: ['-100rad', '100rad'],
  })
  private lastRotate = 0
  private onRotateGestureEvent = Animated.event([{nativeEvent: {rotation: this.rotate}}], {
    useNativeDriver: true,
  })

  private panX = new Animated.Value(0)
  private panY = new Animated.Value(0)
  private lastPanX = 0
  private lastPanY = 0
  private onPanGestureEvent = Animated.event(
    [{nativeEvent: {translationX: this.panX, translationY: this.panY}}],
    {useNativeDriver: true}
  )

  private onRotateHandlerStateChange = (event: RotationGestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      this.lastRotate += event.nativeEvent.rotation
      this.rotate.setOffset(this.lastRotate)
      this.rotate.setValue(0)
    }
  }
  private onPinchHandlerStateChange = (event: PinchGestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      this.lastScale *= event.nativeEvent.scale
      this.baseScale.setValue(this.lastScale)
      this.pinchScale.setValue(1)
    }
  }
  private onPanGestureStateChange = (event: PanGestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      this.lastPanX += event.nativeEvent.translationX
      this.lastPanY += event.nativeEvent.translationY
      this.panX.setOffset(this.lastPanX)
      this.panX.setValue(0)
      this.panY.setOffset(this.lastPanY)
      this.panY.setValue(0)
    }
  }

  private getImageSize = () => {
    this.props.uri &&
      Image.getSize(
        this.props.uri,
        (width, height) => {
          if (!this.mounted) {
            return
          }

          this.setState({height, width})

          // scale to fit
          // const scaleY = this.containerHeight / height
          // const scaleX = this.containerWidth / width
          // if (scaleY > 1 && scaleX > 1) {
          // return
          // }

          // if (scaleY < scaleX) {
          // if (false) {
          // this.panX.addListener(({value}) => console.log('aaaX', {value}))
          // this.panY.addListener(({value}) => console.log('aaaY', {value}))
          // this.pinchScale.addListener(({value}) => console.log('aaaS', {value}))
          // Animated.parallel([
          // Animated.timing(this.pinchScale, {
          // duration: 1000,
          // toValue: 0.5, //scaleY,
          // useNativeDriver: true,
          // }),
          // // Animated.timing(this.opacity, {
          // // duration: 200,
          // // toValue: 1,
          // // useNativeDriver: true,
          // // }),
          // ]).start()
          // } else {
          // }
        },
        () => {}
      )
  }

  componentWillUnmount() {
    this.mounted = false
  }

  componentDidMount() {
    this.getImageSize()
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.uri !== prevProps.uri) {
      this.getImageSize()
    }
  }

  private onLayout = ({
    nativeEvent: {
      layout: {width, height},
    },
  }: LayoutChangeEvent) => {
    this.containerWidth = width
    this.containerHeight = height
  }
  render() {
    return (
      <View onLayout={this.onLayout} style={{flexGrow: 1, position: 'relative'}}>
        <View style={{...Styles.globalStyles.fillAbsolute}}>
          <PanGestureHandler
            ref={this.panRef}
            onGestureEvent={this.onPanGestureEvent}
            onHandlerStateChange={this.onPanGestureStateChange}
            minDist={1}
            minPointers={1}
            maxPointers={1}
          >
            <Animated.View style={styles.wrapper}>
              <RotationGestureHandler
                ref={this.rotationRef}
                simultaneousHandlers={this.pinchRef}
                onGestureEvent={this.onRotateGestureEvent}
                onHandlerStateChange={this.onRotateHandlerStateChange}
              >
                <Animated.View style={styles.wrapper}>
                  <PinchGestureHandler
                    ref={this.pinchRef}
                    simultaneousHandlers={this.rotationRef}
                    onGestureEvent={this.onPinchGestureEvent}
                    onHandlerStateChange={this.onPinchHandlerStateChange}
                  >
                    <Animated.View style={styles.container} collapsable={false}>
                      <Animated.Image
                        onLoad={this.props.onLoad}
                        resizeMode="center"
                        style={[
                          {
                            height: '100%',
                            width: '100%',
                            // height: this.state.height,
                            // opacity: this.opacity,
                            // width: this.state.width,
                          },
                          {
                            transform: [
                              {scale: this.scale},
                              {translateX: this.panX},
                              {translateY: this.panY},
                              {rotate: this.rotateStr},
                            ],
                          },
                        ]}
                        source={{uri: this.props.uri}}
                      />
                    </Animated.View>
                  </PinchGestureHandler>
                </Animated.View>
              </RotationGestureHandler>
            </Animated.View>
          </PanGestureHandler>
        </View>
      </View>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    alignItems: 'center',
    backgroundColor: Styles.globalColors.black,
    flexGrow: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  wrapper: {
    backgroundColor: 'green',
    height: '100%',
    width: '100%',
  },
})

export default ZoomableBox
