import * as React from 'react'
import * as Styles from '../styles'
import {View, Animated, Image} from 'react-native'
import {
  // eslint-disable-next-line
  PanGestureHandlerStateChangeEvent,
  // eslint-disable-next-line
  PinchGestureHandlerStateChangeEvent,
  // eslint-disable-next-line
  TapGestureHandlerGestureEvent,
  PanGestureHandler,
  PinchGestureHandler,
  TapGestureHandler,
  State,
} from 'react-native-gesture-handler'

type Props = {
  allowRotate?: boolean
  onLoad?: () => void
  uri: string
  style?: Styles.StylesCrossPlatform
}

const maxZoom = 10
const minZoom = 0.5

class ZoomableBox extends React.Component<Props, {height: number; width: number}> {
  state = {
    height: 0,
    width: 0,
  }

  private mounted = true

  private panRef = React.createRef<PanGestureHandler>()
  private pinchRef = React.createRef<PinchGestureHandler>()
  private baseScale = new Animated.Value(1)
  private pinchScale = new Animated.Value(1)
  private opacity = new Animated.Value(0)
  private scale = Animated.multiply(this.baseScale, this.pinchScale).interpolate({
    extrapolate: 'clamp',
    inputRange: [0, minZoom, maxZoom, 9999],
    outputRange: [minZoom, minZoom, maxZoom, maxZoom],
  })
  private lastScale = 1
  private onPinchGestureEvent = Animated.event([{nativeEvent: {scale: this.pinchScale}}], {
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

  private onDoubleTap = (event: TapGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      this.lastScale = 1
      this.lastScale = Math.min(Math.max(this.lastScale, minZoom), maxZoom)
      this.lastPanX = 0
      this.lastPanY = 0
      this.panX.flattenOffset()
      this.panY.flattenOffset()
      this.pinchScale.setValue(1)

      const common = {
        duration: 200,
        useNativeDriver: true,
      }
      Animated.parallel([
        Animated.timing(this.baseScale, {...common, toValue: this.lastScale}),
        Animated.timing(this.panX, {...common, toValue: 0}),
        Animated.timing(this.panY, {...common, toValue: 0}),
      ]).start()
    }
  }

  private onPinchHandlerStateChange = (event: PinchGestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      this.lastScale *= event.nativeEvent.scale
      this.lastScale = Math.min(Math.max(this.lastScale, minZoom), maxZoom)
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

  private updateImageSize = (width: number, height: number) => {
    this.mounted && this.setState({height, width})
    Animated.timing(this.opacity, {
      duration: 300,
      toValue: 1,
      useNativeDriver: true,
    }).start()
  }

  private getImageSize = () => {
    this.props.uri && Image.getSize(this.props.uri, this.updateImageSize, () => {})
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

  render() {
    return (
      <TapGestureHandler onHandlerStateChange={this.onDoubleTap} numberOfTaps={2}>
        <View style={{flexGrow: 1, position: 'relative'}}>
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
                <PinchGestureHandler
                  ref={this.pinchRef}
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
                          opacity: this.opacity,
                          width: '100%',
                        },
                        {
                          transform: [{translateX: this.panX}, {translateY: this.panY}, {scale: this.scale}],
                        },
                      ]}
                      source={{uri: this.props.uri}}
                    />
                  </Animated.View>
                </PinchGestureHandler>
              </Animated.View>
            </PanGestureHandler>
          </View>
        </View>
      </TapGestureHandler>
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
