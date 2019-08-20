import * as React from 'react'
import * as Styles from '../styles'
import {LayoutChangeEvent, View, Animated, Image} from 'react-native'
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
  State as GState,
} from 'react-native-gesture-handler'

type Props = {
  allowRotate?: boolean
  onLoad?: () => void
  uri: string
  style?: Styles.StylesCrossPlatform
}

const maxZoom = 10
const minZoom = 0.5

type State = {
  height: number
  imageHeight: number
  imageWidth: number
  width: number
}

class ZoomableImage extends React.Component<Props, State> {
  state = {
    height: 0,
    imageHeight: 0,
    imageWidth: 0,
    width: 0,
  }

  private mounted = true

  private panRef = React.createRef<PanGestureHandler>()
  private pinchRef = React.createRef<PinchGestureHandler>()
  private baseScale = new Animated.Value(1)
  private pinchScale = new Animated.Value(1)
  private opacity = new Animated.Value(0)
  private scale = Animated.multiply(
    this.baseScale,
    this.pinchScale
  ) /*.interpolate({
    extrapolate: 'clamp',
    inputRange: [0, minZoom, maxZoom, 9999],
    outputRange: [minZoom, minZoom, maxZoom, maxZoom],
  })*/
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
    if (event.nativeEvent.state === GState.ACTIVE) {
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

  private updateScale = (next: number) => {
    this.lastScale = next
    // this.lastScale = Math.min(Math.max(this.lastScale, minZoom), maxZoom)
    this.baseScale.setValue(this.lastScale)
    this.pinchScale.setValue(1)
  }

  private onPinchHandlerStateChange = (event: PinchGestureHandlerStateChangeEvent) => {
    console._log(event.nativeEvent.scale)
    if (event.nativeEvent.oldState === GState.ACTIVE) {
      this.updateScale(this.lastScale * event.nativeEvent.scale)
    }
  }

  private updatePan = (nextX: number, nextY: number) => {
    this.lastPanX = nextX
    this.lastPanY = nextY
    this.panX.setOffset(this.lastPanX)
    this.panX.setValue(0)
    this.panY.setOffset(this.lastPanY)
    this.panY.setValue(0)
  }
  private onPanGestureStateChange = (event: PanGestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.oldState === GState.ACTIVE) {
      this.updatePan(
        this.lastPanX + event.nativeEvent.translationX,
        this.lastPanY + event.nativeEvent.translationY
      )
    }
  }

  private resetInitial = (width: number, height: number) => {
    if (!width || !height) {
      return
    }
    const ratioX = this.state.width / width
    const ratioY = this.state.height / height

    let scale: number
    if (ratioX >= 1 && ratioY >= 1) {
      scale = 1
    } else {
      scale = Math.min(ratioX, ratioY)
    }

    this.updateScale(scale)

    // image scales from center!
    const offsetX = (this.state.width - this.state.imageWidth) / 2
    const offsetY = (this.state.height - this.state.imageHeight) / 2
    // console._log('aaa ', {scale, offsetX, offsetY})
    this.updatePan(offsetX, offsetY)
  }

  private updateImageSize = (imageWidth: number, imageHeight: number) => {
    this.mounted && this.setState({imageHeight, imageWidth})

    this.resetInitial(imageWidth, imageHeight)

    Animated.timing(this.opacity, {
      duration: 300,
      toValue: 1,
      useNativeDriver: true,
    }).start()
  }

  private getImageSize = () => {
    this.props.uri && Image.getSize(this.props.uri, this.updateImageSize, () => {})
  }

  private onLayout = (event: LayoutChangeEvent) => {
    const {nativeEvent} = event
    const {layout} = nativeEvent
    const {width, height} = layout
    this.setState({height, width})
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
    // unclear how scale works. just added width/height to innder views
    return (
      <TapGestureHandler onHandlerStateChange={this.onDoubleTap} numberOfTaps={2}>
        <View style={{flexGrow: 1, position: 'relative'}} onLayout={this.onLayout}>
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
                  <Animated.View style={[styles.container]}>
                    <Animated.View
                      key="panner"
                      style={{
                        // backgroundColor: 'red',
                        height: this.state.height,
                        transform: [{translateX: this.panX}, {translateY: this.panY}],
                        width: this.state.width,
                      }}
                    >
                      <Animated.View
                        key="scaler"
                        style={{
                          // backgroundColor: 'orange',
                          height: this.state.height,
                          width: this.state.width,
                        }}
                      >
                        <Animated.Image
                          onLoad={this.props.onLoad}
                          style={{
                            height: this.state.imageHeight,
                            left: 0,
                            opacity: this.opacity,
                            position: 'absolute',
                            top: 0,
                            transform: [{scale: this.scale}],
                            width: this.state.imageWidth,
                          }}
                          source={{uri: this.props.uri}}
                        />
                      </Animated.View>
                    </Animated.View>
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
    backgroundColor: 'pink', // TEMP
    height: '100%',
    position: 'relative',
    width: '100%',
  },
  wrapper: {
    alignItems: 'flex-start',
    backgroundColor: 'green', // TEMP
    height: '100%',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    width: '100%',
  },
})

export default ZoomableImage
