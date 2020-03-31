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
  onClose?: () => void
  onLoad?: () => void
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  uri: string
  style?: Styles.StylesCrossPlatform
}

type State = {
  imageHeight: number
  imageWidth: number
  viewHeight: number
  viewWidth: number
}

class ZoomableImage extends React.Component<Props, State> {
  state = {
    imageHeight: 0,
    imageWidth: 0,
    viewHeight: 0,
    viewWidth: 0,
  }

  private mounted = true

  // opacity
  private opacity = new Animated.Value(0)
  // scale
  private maxZoom = 10
  private minZoom = 0.001 // TODO dynamically calc min zoom
  private pinchRef = React.createRef<PinchGestureHandler>()

  private baseScale = new Animated.Value(1)
  private pinchScale = new Animated.Value(1)
  private scale = Animated.multiply(this.baseScale, this.pinchScale).interpolate({
    extrapolate: 'clamp',
    inputRange: [0, this.minZoom, this.maxZoom, 9999],
    outputRange: [this.minZoom, this.minZoom, this.maxZoom, this.maxZoom],
  })
  private lastScale = 1
  private onPinchGestureEvent = Animated.event([{nativeEvent: {scale: this.pinchScale}}], {
    useNativeDriver: true,
  })
  // pan
  private maxPanX = 0
  private maxPanY = 0
  private minPanX = 0
  private minPanY = 0
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
      const {scale, offsetX, offsetY} = this.getInitialScaleAndOffset(
        this.state.imageWidth,
        this.state.imageHeight
      )
      this.updateScale(scale, true)
      this.updatePan(offsetX, offsetY, true)
    }
  }

  private animatedCommon = {duration: 200, useNativeDriver: true}

  private updateScale = (next: number, animated?: boolean) => {
    const scale = Math.min(Math.max(next, this.minZoom), this.maxZoom)
    this.lastScale = scale

    const setupScaleForNextGesture = () => {
      this.baseScale.setValue(next)
      this.pinchScale.setValue(1)
    }

    if (animated) {
      this.pinchScale.setValue(1)
      Animated.timing(this.baseScale, {...this.animatedCommon, toValue: next}).start(setupScaleForNextGesture)
    } else {
      setupScaleForNextGesture()
    }
  }

  private onPinchHandlerStateChange = (event: PinchGestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.oldState === GState.ACTIVE) {
      this.updateScale(this.lastScale * event.nativeEvent.scale)
    }
  }

  // called after a pan is done, or explicitly. We need to set the offset so the initial state is kept
  private updatePan = (nextX: number, nextY: number, animated?: boolean) => {
    const panX = Math.min(Math.max(nextX, this.minPanX), this.maxPanX)
    const panY = Math.min(Math.max(nextY, this.minPanY), this.maxPanY)

    this.lastPanX = panX
    this.lastPanY = panY

    const setupPanForNextGesture = () => {
      this.panX.setOffset(panX)
      this.panX.setValue(0)
      this.panY.setOffset(panY)
      this.panY.setValue(0)
    }

    if (animated) {
      this.panX.flattenOffset()
      this.panY.flattenOffset()
      Animated.parallel([
        Animated.timing(this.panX, {...this.animatedCommon, toValue: panX}),
        Animated.timing(this.panY, {...this.animatedCommon, toValue: panY}),
      ]).start(setupPanForNextGesture) // after the animation we need the offset updated else
      // a touch won't have the offset
    } else {
      setupPanForNextGesture()
    }
  }
  private onPanGestureStateChange = (event: PanGestureHandlerStateChangeEvent) => {
    const {nativeEvent} = event
    const {oldState, velocityX, velocityY, translationX, translationY} = nativeEvent
    // pan is done, update the state
    if (oldState === GState.ACTIVE) {
      const swipeThreshold = 1000
      const orthoThreshold = 300
      const dragThreshold = 100
      const smallY = Math.abs(translationY) < orthoThreshold
      const smallX = Math.abs(translationX) < orthoThreshold
      const bigX = Math.abs(translationX) > dragThreshold
      const bigY = Math.abs(translationY) > dragThreshold
      const sideSwipe = smallY && bigX
      const vertSwipe = smallX && bigY
      if (this.props.onSwipeLeft && velocityX > swipeThreshold && sideSwipe) {
        // fast swipe left?
        this.props.onSwipeLeft()
      } else if (this.props.onSwipeRight && velocityX < -swipeThreshold && sideSwipe) {
        this.props.onSwipeRight()
      } else if (this.props.onClose && velocityY > swipeThreshold && vertSwipe) {
        this.props.onClose()
      } else {
        this.updatePan(
          this.lastPanX + event.nativeEvent.translationX,
          this.lastPanY + event.nativeEvent.translationY
        )
      }
    }
  }

  // given an image size, figure out the scale/pan to constrain it
  private getInitialScaleAndOffset = (imageWidth: number, imageHeight: number) => {
    if (!imageWidth || !imageHeight) {
      return {offsetX: 0, offsetY: 0, scale: 1}
    }
    const ratioX = this.state.viewWidth / imageWidth
    const ratioY = this.state.viewHeight / imageHeight

    let scale: number
    if (ratioX >= 1 && ratioY >= 1) {
      scale = 1
    } else {
      // do we need to scale down? choose the larger size
      scale = Math.min(ratioX, ratioY)
    }

    // image scales from center!
    const offsetX = (this.state.viewWidth - this.state.imageWidth) / 2
    const offsetY = (this.state.viewHeight - this.state.imageHeight) / 2
    return {offsetX, offsetY, scale}
  }

  private resetInitial = (imageWidth: number, imageHeight: number) => {
    const {scale, offsetX, offsetY} = this.getInitialScaleAndOffset(imageWidth, imageHeight)
    this.updateScale(scale)
    this.updatePan(offsetX, offsetY)
  }

  private updateImageSize = (imageWidth: number, imageHeight: number) => {
    this.mounted && this.setState({imageHeight, imageWidth})

    this.resetInitial(imageWidth, imageHeight)
    this.state.viewHeight &&
      this.state.viewWidth &&
      Animated.timing(this.opacity, {...this.animatedCommon, toValue: 1}).start()
  }

  private getImageSize = () => {
    this.props.uri && Image.getSize(this.props.uri, this.updateImageSize, () => {})
  }

  private onLayout = (event: LayoutChangeEvent) => {
    const {nativeEvent} = event
    const {layout} = nativeEvent
    const {width, height} = layout
    // There's a race where when you view an image the second time, image size
    // comes in before onLayout gets the view sizes (viewHeight and viewWidth).
    // And getInitialScaleAndOffset ends up doing a crazy zoom/rotate. So call
    // getImageSize here as well to make sure resetInitial is called when all
    // values are available.
    this.setState({viewHeight: height, viewWidth: width}, this.getImageSize)
  }

  componentWillUnmount() {
    this.mounted = false
  }

  componentDidMount() {
    this.getImageSize()
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.uri !== prevProps.uri) {
      Animated.timing(this.opacity, {...this.animatedCommon, toValue: 0}).start()
      this.getImageSize()
    }
  }

  render() {
    // TODO at some point make this perfect w/ scale
    const padding = 20
    let panX: Animated.AnimatedInterpolation
    let panY: Animated.AnimatedInterpolation
    if (this.state.viewWidth) {
      this.minPanX = -this.state.imageWidth + padding
      this.maxPanX = this.state.viewWidth - padding
      this.minPanY = -this.state.imageHeight + padding
      this.maxPanY = this.state.viewHeight - padding

      panX = this.panX.interpolate({
        extrapolate: 'clamp',
        inputRange: [this.minPanX, this.maxPanX],
        outputRange: [this.minPanX, this.maxPanX],
      })
      panY = this.panY.interpolate({
        extrapolate: 'clamp',
        inputRange: [this.minPanY, this.maxPanY],
        outputRange: [this.minPanY, this.maxPanY],
      })
    } else {
      panX = this.panX
      panY = this.panY
    }

    return (
      <TapGestureHandler onHandlerStateChange={this.onDoubleTap} numberOfTaps={2}>
        <View style={styles.outerContainer} onLayout={this.onLayout}>
          <View style={Styles.globalStyles.fillAbsolute}>
            <PanGestureHandler
              simultaneousHandlers={this.pinchRef}
              onGestureEvent={this.onPanGestureEvent}
              onHandlerStateChange={this.onPanGestureStateChange}
              minDist={1}
              minPointers={1}
              maxPointers={2}
              avgTouches={true}
            >
              <Animated.View style={styles.pannedView}>
                <PinchGestureHandler
                  ref={this.pinchRef}
                  onGestureEvent={this.onPinchGestureEvent}
                  onHandlerStateChange={this.onPinchHandlerStateChange}
                >
                  <Animated.View style={[styles.container]}>
                    <Animated.View
                      key="panner"
                      style={{
                        height: this.state.viewHeight,
                        transform: [{translateX: panX}, {translateY: panY}],
                        width: this.state.viewWidth,
                      }}
                    >
                      <Animated.View
                        key="scaler"
                        style={{
                          height: this.state.viewHeight,
                          width: this.state.viewWidth,
                        }}
                      >
                        <Animated.Image
                          onLoad={this.props.onLoad}
                          style={[
                            styles.image,
                            {
                              height: this.state.imageHeight,
                              opacity: this.opacity,
                              transform: [{scale: this.scale}],
                              width: this.state.imageWidth,
                            },
                          ]}
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        height: '100%',
        position: 'relative',
        width: '100%',
      },
      image: {
        left: 0,
        position: 'absolute',
        top: 0,
      },
      outerContainer: {flexGrow: 1, position: 'relative'},
      pannedView: {
        alignItems: 'flex-start',
        height: '100%',
        justifyContent: 'flex-start',
        overflow: 'hidden',
        width: '100%',
      },
    } as const)
)

export default ZoomableImage
