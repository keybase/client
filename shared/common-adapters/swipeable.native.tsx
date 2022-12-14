// port of https://raw.githubusercontent.com/software-mansion/react-native-gesture-handler/main/src/components/Swipeable.tsx
// Similarily to the DrawerLayout component this deserves to be put in a
// separate repo. Although, keeping it here for the time being will allow us to
// move faster and fix possible issues quicker

import * as React from 'react'
import {Component} from 'react'
import {
  Animated,
  StyleSheet,
  View,
  I18nManager,
  LayoutChangeEvent,
  StyleProp,
  ViewStyle,
  Pressable,
} from 'react-native'

import {
  GestureEvent,
  HandlerStateChangeEvent,
  PanGestureHandler,
  PanGestureHandlerEventPayload,
  PanGestureHandlerProps,
  TapGestureHandler,
  TapGestureHandlerEventPayload,
  State,
  Gesture,
  GestureUpdateEvent,
  GestureDetector,
} from 'react-native-gesture-handler'

import * as Reanimated from 'react-native-reanimated'

const DRAG_TOSS = 0.05

type SwipeableExcludes = Exclude<keyof PanGestureHandlerProps, 'onGestureEvent' | 'onHandlerStateChange'>

// Animated.AnimatedInterpolation has been converted to a generic type
// in @types/react-native 0.70. This way we can maintain compatibility
// with all versions of @types/react-native
type AnimatedInterpolation = ReturnType<Animated.Value['interpolate']>

export interface SwipeableProps extends Pick<PanGestureHandlerProps, SwipeableExcludes> {
  /**
   * Enables two-finger gestures on supported devices, for example iPads with
   * trackpads. If not enabled the gesture will require click + drag, with
   * `enableTrackpadTwoFingerGesture` swiping with two fingers will also trigger
   * the gesture.
   */
  enableTrackpadTwoFingerGesture?: boolean

  /**
   * Specifies how much the visual interaction will be delayed compared to the
   * gesture distance. e.g. value of 1 will indicate that the swipeable panel
   * should exactly follow the gesture, 2 means it is going to be two times
   * "slower".
   */
  friction?: number

  /**
   * Distance from the left edge at which released panel will animate to the
   * open state (or the open panel will animate into the closed state). By
   * default it's a half of the panel's width.
   */
  leftThreshold?: number

  /**
   * Distance from the right edge at which released panel will animate to the
   * open state (or the open panel will animate into the closed state). By
   * default it's a half of the panel's width.
   */
  rightThreshold?: number

  /**
   * Value indicating if the swipeable panel can be pulled further than the left
   * actions panel's width. It is set to true by default as long as the left
   * panel render method is present.
   */
  overshootLeft?: boolean

  /**
   * Value indicating if the swipeable panel can be pulled further than the
   * right actions panel's width. It is set to true by default as long as the
   * right panel render method is present.
   */
  overshootRight?: boolean

  /**
   * Specifies how much the visual interaction will be delayed compared to the
   * gesture distance at overshoot. Default value is 1, it mean no friction, for
   * a native feel, try 8 or above.
   */
  overshootFriction?: number

  /**
   * @deprecated Use `direction` argument of onSwipeableOpen()
   *
   * Called when left action panel gets open.
   */
  onSwipeableLeftOpen?: () => void

  /**
   * @deprecated Use `direction` argument of onSwipeableOpen()
   *
   * Called when right action panel gets open.
   */
  onSwipeableRightOpen?: () => void

  /**
   * Called when action panel gets open (either right or left).
   */
  onSwipeableOpen?: (direction: 'left' | 'right', swipeable: Swipeable) => void

  /**
   * Called when action panel is closed.
   */
  onSwipeableClose?: (direction: 'left' | 'right', swipeable: Swipeable) => void

  /**
   * @deprecated Use `direction` argument of onSwipeableWillOpen()
   *
   * Called when left action panel starts animating on open.
   */
  onSwipeableLeftWillOpen?: () => void

  /**
   * @deprecated Use `direction` argument of onSwipeableWillOpen()
   *
   * Called when right action panel starts animating on open.
   */
  onSwipeableRightWillOpen?: () => void

  /**
   * Called when action panel starts animating on open (either right or left).
   */
  onSwipeableWillOpen?: (direction: 'left' | 'right') => void

  /**
   * Called when action panel starts animating on close.
   */
  onSwipeableWillClose?: (direction: 'left' | 'right') => void

  /**
   *
   * This map describes the values to use as inputRange for extra interpolation:
   * AnimatedValue: [startValue, endValue]
   *
   * progressAnimatedValue: [0, 1] dragAnimatedValue: [0, +]
   *
   * To support `rtl` flexbox layouts use `flexDirection` styling.
   * */
  renderLeftActions?: (
    progressAnimatedValue: AnimatedInterpolation,
    dragAnimatedValue: AnimatedInterpolation
  ) => React.ReactNode
  /**
   *
   * This map describes the values to use as inputRange for extra interpolation:
   * AnimatedValue: [startValue, endValue]
   *
   * progressAnimatedValue: [0, 1] dragAnimatedValue: [0, -]
   *
   * To support `rtl` flexbox layouts use `flexDirection` styling.
   * */
  renderRightActions?: (
    progressAnimatedValue: AnimatedInterpolation,
    dragAnimatedValue: AnimatedInterpolation,
    swipeable: Swipeable
  ) => React.ReactNode

  useNativeAnimations?: boolean

  animationOptions?: Record<string, unknown>

  /**
   * Style object for the container (`Animated.View`), for example to override
   * `overflow: 'hidden'`.
   */
  containerStyle?: StyleProp<ViewStyle>

  /**
   * Style object for the children container (`Animated.View`), for example to
   * apply `flex: 1`
   */
  childrenContainerStyle?: StyleProp<ViewStyle>
}

type SwipeableState = {
  dragX: Animated.Value
  rowTranslation: Animated.Value
  rowState: number
  leftWidth?: number
  rightOffset?: number
  rowWidth?: number
}

export default class Swipeable extends Component<SwipeableProps, SwipeableState> {
  static defaultProps = {
    friction: 1,
    overshootFriction: 1,
    useNativeAnimations: true,
  }

  constructor(props: SwipeableProps) {
    super(props)
    const dragX = new Animated.Value(0)
    this.state = {
      dragX,
      rowTranslation: new Animated.Value(0),
      rowState: 0,
      leftWidth: undefined,
      rightOffset: undefined,
      rowWidth: undefined,
    }
    this.updateAnimatedEvent(props, this.state)

    this.onGestureEvent = Animated.event([{nativeEvent: {translationX: dragX}}], {
      useNativeDriver: props.useNativeAnimations!,
    })
  }

  shouldComponentUpdate(props: SwipeableProps, state: SwipeableState) {
    if (
      this.props.friction !== props.friction ||
      this.props.overshootLeft !== props.overshootLeft ||
      this.props.overshootRight !== props.overshootRight ||
      this.props.overshootFriction !== props.overshootFriction ||
      this.state.leftWidth !== state.leftWidth ||
      this.state.rightOffset !== state.rightOffset ||
      this.state.rowWidth !== state.rowWidth
    ) {
      this.updateAnimatedEvent(props, state)
    }

    return true
  }

  private onGestureEvent?: (event: GestureEvent<PanGestureHandlerEventPayload>) => void
  private transX?: AnimatedInterpolation
  private showLeftAction?: AnimatedInterpolation | Animated.Value
  private leftActionTranslate?: AnimatedInterpolation
  private showRightAction?: AnimatedInterpolation | Animated.Value
  private rightActionTranslate?: AnimatedInterpolation

  private updateAnimatedEvent = (props: SwipeableProps, state: SwipeableState) => {
    const {friction, overshootFriction} = props
    const {dragX, rowTranslation, leftWidth = 0, rowWidth = 0} = state
    const {rightOffset = rowWidth} = state
    const rightWidth = Math.max(0, rowWidth - rightOffset)

    const {overshootLeft = leftWidth > 0, overshootRight = rightWidth > 0} = props

    const transX = Animated.add(
      rowTranslation,
      dragX.interpolate({
        inputRange: [0, friction!],
        outputRange: [0, 1],
      })
    ).interpolate({
      inputRange: [-rightWidth - 1, -rightWidth, leftWidth, leftWidth + 1],
      outputRange: [
        -rightWidth - (overshootRight ? 1 / overshootFriction! : 0),
        -rightWidth,
        leftWidth,
        leftWidth + (overshootLeft ? 1 / overshootFriction! : 0),
      ],
    })
    this.transX = transX
    this.showLeftAction =
      leftWidth > 0
        ? transX.interpolate({
            inputRange: [-1, 0, leftWidth],
            outputRange: [0, 0, 1],
          })
        : new Animated.Value(0)
    this.leftActionTranslate = this.showLeftAction.interpolate({
      inputRange: [0, Number.MIN_VALUE],
      outputRange: [-10000, 0],
      extrapolate: 'clamp',
    })
    this.showRightAction =
      rightWidth > 0
        ? transX.interpolate({
            inputRange: [-rightWidth, 0, 1],
            outputRange: [1, 0, 0],
          })
        : new Animated.Value(0)
    this.rightActionTranslate = this.showRightAction.interpolate({
      inputRange: [0, Number.MIN_VALUE],
      outputRange: [-10000, 0],
      extrapolate: 'clamp',
    })
  }

  private onTapHandlerStateChange = ({
    nativeEvent,
  }: HandlerStateChangeEvent<TapGestureHandlerEventPayload>) => {
    if (nativeEvent.oldState === State.ACTIVE) {
      this.close()
    }
  }

  // KB to avoid unnecessary rerender when first mounting, we stash the sizes until we actually get a pan
  private pressed = false
  private width = undefined
  private offset = undefined
  private onHandlerStateChange = (ev: HandlerStateChangeEvent<PanGestureHandlerEventPayload>) => {
    if (ev.nativeEvent.oldState === State.ACTIVE) {
      this.handleRelease(ev)
    }
    // KB
    if (ev.nativeEvent.numberOfPointers > 0 && !this.pressed) {
      this.pressed = true
      if (this.props.renderLeftActions) {
        this.setState({leftWidth: this.offset, rowWidth: this.width})
      } else if (this.props.renderRightActions) {
        this.setState({rightOffset: this.offset, rowWidth: this.width})
      }
    }
  }

  private handleRelease = (ev: HandlerStateChangeEvent<PanGestureHandlerEventPayload>) => {
    const {velocityX, translationX: dragX} = ev.nativeEvent
    const {leftWidth = 0, rowWidth = 0, rowState} = this.state
    const {rightOffset = rowWidth} = this.state
    const rightWidth = rowWidth - rightOffset
    const {friction, leftThreshold = leftWidth / 2, rightThreshold = rightWidth / 2} = this.props

    const startOffsetX = this.currentOffset() + dragX / friction!
    const translationX = (dragX + DRAG_TOSS * velocityX) / friction!

    let toValue = 0
    if (rowState === 0) {
      if (translationX > leftThreshold) {
        toValue = leftWidth
      } else if (translationX < -rightThreshold) {
        toValue = -rightWidth
      }
    } else if (rowState === 1) {
      // swiped to left
      if (translationX > -leftThreshold) {
        toValue = leftWidth
      }
    } else {
      // swiped to right
      if (translationX < rightThreshold) {
        toValue = -rightWidth
      }
    }

    this.animateRow(startOffsetX, toValue, velocityX / friction!)
  }

  private animateRow = (
    fromValue: number,
    toValue: number,
    velocityX?:
      | number
      | {
          x: number
          y: number
        }
  ) => {
    const {dragX, rowTranslation} = this.state
    dragX.setValue(0)
    rowTranslation.setValue(fromValue)

    this.setState({rowState: Math.sign(toValue)})
    Animated.spring(rowTranslation, {
      restSpeedThreshold: 1.7,
      restDisplacementThreshold: 0.4,
      velocity: velocityX,
      bounciness: 0,
      toValue,
      useNativeDriver: this.props.useNativeAnimations!,
      ...this.props.animationOptions,
    }).start(({finished}) => {
      if (finished) {
        if (toValue > 0) {
          this.props.onSwipeableLeftOpen?.()
          this.props.onSwipeableOpen?.('left', this)
        } else if (toValue < 0) {
          this.props.onSwipeableRightOpen?.()
          this.props.onSwipeableOpen?.('right', this)
        } else {
          const closingDirection = fromValue > 0 ? 'left' : 'right'
          this.props.onSwipeableClose?.(closingDirection, this)
        }
      }
    })
    if (toValue > 0) {
      this.props.onSwipeableLeftWillOpen?.()
      this.props.onSwipeableWillOpen?.('left')
    } else if (toValue < 0) {
      this.props.onSwipeableRightWillOpen?.()
      this.props.onSwipeableWillOpen?.('right')
    } else {
      const closingDirection = fromValue > 0 ? 'left' : 'right'
      this.props.onSwipeableWillClose?.(closingDirection)
    }
  }

  private onRowLayout = ({nativeEvent}: LayoutChangeEvent) => {
    // KB just stash it
    this.width = nativeEvent.layout.width
    // this.setState({rowWidth: nativeEvent.layout.width})
  }

  private currentOffset = () => {
    const {leftWidth = 0, rowWidth = 0, rowState} = this.state
    const {rightOffset = rowWidth} = this.state
    const rightWidth = rowWidth - rightOffset
    if (rowState === 1) {
      return leftWidth
    } else if (rowState === -1) {
      return -rightWidth
    }
    return 0
  }

  close = () => {
    this.animateRow(this.currentOffset(), 0)
  }

  openLeft = () => {
    const {leftWidth = 0} = this.state
    this.animateRow(this.currentOffset(), leftWidth)
  }

  openRight = () => {
    const {rowWidth = 0} = this.state
    const {rightOffset = rowWidth} = this.state
    const rightWidth = rowWidth - rightOffset
    this.animateRow(this.currentOffset(), -rightWidth)
  }

  render() {
    const {rowState} = this.state
    const {children, renderLeftActions, renderRightActions} = this.props

    const left = renderLeftActions && (
      <Animated.View
        style={[
          styles.leftActions,
          // all those and below parameters can have ! since they are all
          // asigned in constructor in `updateAnimatedEvent` but TS cannot spot
          // it for some reason
          {transform: [{translateX: this.leftActionTranslate!}]},
        ]}
      >
        {renderLeftActions(this.showLeftAction!, this.transX!)}
        <View
          onLayout={({nativeEvent}) => {
            // KB just stash it
            this.offset = nativeEvent.layout.x
            // this.setState({leftWidth: nativeEvent.layout.x})
          }}
        />
      </Animated.View>
    )

    const right = renderRightActions && (
      <Animated.View style={[styles.rightActions, {transform: [{translateX: this.rightActionTranslate!}]}]}>
        {renderRightActions(this.showRightAction!, this.transX!, this)}
        <View
          onLayout={({nativeEvent}) => {
            // KB just stash it
            this.offset = nativeEvent.layout.x
            // this.setState({rightOffset: nativeEvent.layout.x})
          }}
        />
      </Animated.View>
    )

    return (
      <PanGestureHandler
        activeOffsetX={[-10, 10]}
        {...this.props}
        onGestureEvent={this.onGestureEvent}
        onHandlerStateChange={this.onHandlerStateChange}
      >
        <Animated.View onLayout={this.onRowLayout} style={[styles.container, this.props.containerStyle]}>
          {left}
          {right}
          <TapGestureHandler enabled={rowState !== 0} onHandlerStateChange={this.onTapHandlerStateChange}>
            <Animated.View
              pointerEvents={rowState === 0 ? 'auto' : 'box-only'}
              style={[
                {
                  transform: [{translateX: this.transX!}],
                },
                this.props.childrenContainerStyle,
              ]}
            >
              {children}
            </Animated.View>
          </TapGestureHandler>
        </Animated.View>
      </PanGestureHandler>
    )
  }
}

// to be extra careful about closing over extra variables, we try and limit sharing any parent scopes
const useActionsEnabled = (actionWidth: number, tx: Reanimated.SharedValue<number>) => {
  const openSync = Reanimated.useSharedValue(false)
  const [actionsEnabled, setActionsEnabled] = React.useState(false)
  Reanimated.useAnimatedReaction(
    () => -tx.value > actionWidth * 0.8,
    open => {
      if (open !== openSync.value) {
        openSync.value = open
        Reanimated.runOnJS(setActionsEnabled)(open)
      }
    }
  )

  return {actionsEnabled}
}

const useSyncClosing = (
  tx: Reanimated.SharedValue<number>,
  swipeCloseRef?: React.MutableRefObject<(() => void) | null>
) => {
  const [hasSwiped, setHasSwiped] = React.useState(false)
  const closeSelf = React.useCallback(() => {
    swipeCloseRef?.current?.()
    if (swipeCloseRef) {
      swipeCloseRef.current = null
    }
  }, [swipeCloseRef])
  const closeOthersAndRegisterClose = React.useCallback(() => {
    setHasSwiped(true)
    swipeCloseRef?.current?.()
    if (swipeCloseRef) {
      swipeCloseRef.current = () => {
        tx.value = Reanimated.withSpring(0, {
          stiffness: 100,
          damping: 30,
        })
        swipeCloseRef.current = null
      }
    }
  }, [swipeCloseRef])

  return {closeSelf, closeOthersAndRegisterClose, hasSwiped}
}

const useGesture = (
  actionWidth: number,
  tx: Reanimated.SharedValue<number>,
  closeOthersAndRegisterClose: () => void,
  closeSelf: () => void
) => {
  const startx = Reanimated.useSharedValue(0)
  const dx = Reanimated.useSharedValue(0)

  const gesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .minPointers(1)
    .maxPointers(1)
    .onStart(() => {
      Reanimated.runOnJS(closeOthersAndRegisterClose)()
    })
    .onFinalize((_e, success) => {
      const closing = dx.value >= 0
      if (!success || closing) {
        startx.value = 0
        Reanimated.runOnJS(closeSelf)()
      } else {
        tx.value = Reanimated.withSpring(-actionWidth, {
          stiffness: 100,
          damping: 30,
        })
        startx.value = -actionWidth
      }
    })
    .onUpdate((e: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
      dx.value = e.velocityX
      tx.value = Reanimated.withSpring(Math.min(0, Math.max(-actionWidth, e.translationX + startx.value)), {
        stiffness: 100,
        damping: 30,
      })
    })
  return gesture
}

export const Swipeable2 = React.memo(function Swipeable2(p: {
  children: React.ReactNode
  actionWidth: number
  makeActions: (progress: Reanimated.SharedValue<number>) => React.ReactNode
  swipeCloseRef?: React.MutableRefObject<(() => void) | null>
}) {
  const {children, actionWidth, makeActions, swipeCloseRef} = p
  const tx = Reanimated.useSharedValue(0)
  const {actionsEnabled} = useActionsEnabled(actionWidth, tx)
  const rowStyle = Reanimated.useAnimatedStyle(() => ({transform: [{translateX: tx.value}]}))
  const actionStyle = Reanimated.useAnimatedStyle(() => ({width: -tx.value}))
  const {closeSelf, closeOthersAndRegisterClose, hasSwiped} = useSyncClosing(tx, swipeCloseRef)
  const gesture = useGesture(actionWidth, tx, closeOthersAndRegisterClose, closeSelf)
  const actions = React.useMemo(() => {
    return hasSwiped ? makeActions(tx) : null
  }, [makeActions, hasSwiped])

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.container}>
        <Reanimated.default.View
          style={[styles.actionContainer, actionStyle]}
          pointerEvents={actionsEnabled ? undefined : 'none'}
        >
          {actions}
        </Reanimated.default.View>
        <Reanimated.default.View style={[styles.rowContainer, rowStyle]}>
          <Pressable
            pointerEvents={actionsEnabled ? 'box-only' : undefined}
            onPress={actionsEnabled ? closeSelf : undefined}
          >
            {children}
          </Pressable>
        </Reanimated.default.View>
      </View>
    </GestureDetector>
  )
})

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
    flexDirection: 'column',
  },
  rowContainer: {
    width: '100%',
  },
  actionContainer: {
    position: 'absolute',
    alignSelf: 'flex-end',
    overflow: 'hidden',
    height: '100%',
  },
  leftActions: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
  },
  rightActions: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
  },
})
