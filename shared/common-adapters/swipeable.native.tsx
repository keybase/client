import * as React from 'react'
import {StyleSheet, View, Pressable, Animated, PanResponder} from 'react-native'
import {
  type PanGestureHandlerEventPayload,
  Gesture,
  type GestureUpdateEvent,
  GestureDetector,
} from 'react-native-gesture-handler'
import * as Styles from '@/styles'
import {colors, darkColors} from '@/styles/colors'
import * as Reanimated from 'react-native-reanimated'

// to be extra careful about closing over extra variables, we try and limit sharing any parent scopes
const useActionsEnabled = (tx: Reanimated.SharedValue<number>) => {
  const openSync = Reanimated.useSharedValue(false)
  const [actionsEnabled, setActionsEnabled] = React.useState(false)
  Reanimated.useAnimatedReaction(
    () => -tx.value > 10,
    open => {
      if (open !== openSync.value) {
        openSync.value = open
        Reanimated.runOnJS(setActionsEnabled)(open)
      }
    }
  )

  return {actionsEnabled}
}

const useMakeCloseSelf = (swipeCloseRef?: React.MutableRefObject<(() => void) | null>) => {
  return React.useCallback(() => {
    swipeCloseRef?.current?.()
    if (swipeCloseRef) {
      swipeCloseRef.current = null
    }
  }, [swipeCloseRef])
}

const makeSwipeClose = (
  tx: Reanimated.SharedValue<number>,
  swipeCloseRef: undefined | React.MutableRefObject<(() => void) | null>
) => {
  return function swipeClose() {
    tx.value = Reanimated.withSpring(0, {
      damping: 30,
      stiffness: 300,
    })
    if (swipeCloseRef) swipeCloseRef.current = null
  }
}

const useMakeCloseOthersAndRegisterClose = (
  swipeCloseRef: undefined | React.MutableRefObject<(() => void) | null>,
  setHasSwiped: (s: boolean) => void,
  tx: Reanimated.SharedValue<number>
) => {
  return React.useCallback(() => {
    setHasSwiped(true)
    swipeCloseRef?.current?.()
    if (swipeCloseRef) {
      swipeCloseRef.current = makeSwipeClose(tx, swipeCloseRef)
    }
  }, [setHasSwiped, tx, swipeCloseRef])
}

const useSyncClosing = (
  tx: Reanimated.SharedValue<number>,
  swipeCloseRef?: React.MutableRefObject<(() => void) | null>
) => {
  const [hasSwiped, setHasSwiped] = React.useState(false)
  const closeSelf = useMakeCloseSelf(swipeCloseRef)
  const closeOthersAndRegisterClose = useMakeCloseOthersAndRegisterClose(swipeCloseRef, setHasSwiped, tx)
  return {closeOthersAndRegisterClose, closeSelf, hasSwiped}
}

const makePanOnStart = (
  tx: Reanimated.SharedValue<number>,
  startx: Reanimated.SharedValue<number>,
  started: Reanimated.SharedValue<boolean>,
  closeOthersAndRegisterClose: () => void
) => {
  return function onStart() {
    closeOthersAndRegisterClose()
    Reanimated.cancelAnimation(tx)
    startx.value = tx.value
    started.value = true
  }
}

const makePanOnFinalize = (
  tx: Reanimated.SharedValue<number>,
  startx: Reanimated.SharedValue<number>,
  started: Reanimated.SharedValue<boolean>,
  closeSelf: () => void,
  actionWidth: number
) => {
  return function onFinalize(e: GestureUpdateEvent<PanGestureHandlerEventPayload>, success: boolean) {
    if (!started.value) {
      return
    }
    const closing = e.velocityX >= 0
    if (!success || closing) {
      Reanimated.cancelAnimation(tx)
      tx.value = 0
      closeSelf()
    } else {
      Reanimated.cancelAnimation(tx)
      tx.value = Reanimated.withSpring(-actionWidth, {
        damping: 30,
        stiffness: 100,
      })
      startx.value = -actionWidth
    }

    started.value = false
  }
}

const makePanOnUpdate = (
  tx: Reanimated.SharedValue<number>,
  startx: Reanimated.SharedValue<number>,
  actionWidth: number
) => {
  return function onUpdate(e: GestureUpdateEvent<PanGestureHandlerEventPayload>) {
    tx.value = Math.min(0, Math.max(-actionWidth, e.translationX + startx.value))
  }
}

const makeTapOnStart = () => () => {}
const makeTapOnEnd = (isOpen: boolean, onClick?: () => void) => {
  return function tapOnEnd() {
    if (isOpen) {
      return
    }
    onClick && Reanimated.runOnJS(onClick)()
  }
}

const useMakeSetIsOpenReaction = (tx: Reanimated.SharedValue<number>, setIsOpen: (p: boolean) => void) => {
  Reanimated.useAnimatedReaction(
    () => {
      'worklet'
      return tx.value < 0
    },
    (cur, prev) => {
      'worklet'
      if (cur !== prev) {
        Reanimated.runOnJS(setIsOpen)(cur)
      }
    }
  )
}

const useGesture = (
  actionWidth: number,
  tx: Reanimated.SharedValue<number>,
  closeOthersAndRegisterClose: () => void,
  closeSelf: () => void,
  extraData: unknown,
  onClick?: () => void
) => {
  const started = Reanimated.useSharedValue(false)
  const [isOpen, setIsOpen] = React.useState(false)
  const startx = Reanimated.useSharedValue(0)
  const [lastED, setLastED] = React.useState(extraData)

  // parent is different, close immediately
  if (lastED !== extraData) {
    setLastED(extraData)
    startx.value = 0
    Reanimated.cancelAnimation(tx)
    tx.value = 0
  }

  useMakeSetIsOpenReaction(tx, setIsOpen)

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .minPointers(1)
    .maxPointers(1)
    .onStart(makePanOnStart(tx, startx, started, closeOthersAndRegisterClose))
    .onFinalize(makePanOnFinalize(tx, startx, started, closeSelf, actionWidth))
    .onUpdate(makePanOnUpdate(tx, startx, actionWidth))

  const tapGesture = Gesture.Tap()
    .onStart(makeTapOnStart())
    .onEnd(makeTapOnEnd(isOpen, onClick))
    .enabled(!isOpen)

  return Gesture.Race(panGesture, tapGesture)
}

const makeRowStyle = (tx: Reanimated.SharedValue<number>, solidColor?: string, clearColor?: string) => {
  return function rowStyleFunc() {
    'worklet'
    return {
      backgroundColor: tx.value < 0 ? solidColor : clearColor,
      transform: [{translateX: tx.value}],
    }
  }
}

// A row swipe container. Shows actions below
export const Swipeable = React.memo(function Swipeable2(p: {
  children: React.ReactNode
  actionWidth: number
  makeActionsRef: React.MutableRefObject<(p: Reanimated.SharedValue<number>) => React.ReactNode>
  swipeCloseRef?: React.MutableRefObject<(() => void) | null>
  style?: Styles.StylesCrossPlatform
  extraData?: unknown
  onClick?: () => void
}) {
  const {children, actionWidth, makeActionsRef, swipeCloseRef, style, extraData, onClick} = p
  const tx = Reanimated.useSharedValue(0)
  const {actionsEnabled} = useActionsEnabled(tx)
  const isDarkMode = React.useContext(Styles.DarkModeContext)
  const solidColor = isDarkMode ? darkColors.white : colors.white
  const clearColor = isDarkMode ? darkColors.fastBlank : colors.fastBlank
  const rowStyle = Reanimated.useAnimatedStyle(makeRowStyle(tx, solidColor, clearColor))
  const actionStyle = Reanimated.useAnimatedStyle(() => ({
    width: Math.min(actionWidth, Math.max(0, -tx.value)),
  }))
  const {closeSelf, closeOthersAndRegisterClose, hasSwiped} = useSyncClosing(tx, swipeCloseRef)
  const gesture = useGesture(actionWidth, tx, closeOthersAndRegisterClose, closeSelf, extraData, onClick)
  const actions = hasSwiped ? makeActionsRef.current(tx) : null

  const [lastED, setLastED] = React.useState(extraData)

  // parent is different, close immediately
  if (lastED !== extraData) {
    setLastED(extraData)
    tx.value = 0
  }

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.container, style]}>
        {actions ? (
          <Reanimated.default.View
            style={[styles.actionContainer, actionStyle]}
            pointerEvents={actionsEnabled ? undefined : 'none'}
          >
            {actions}
          </Reanimated.default.View>
        ) : null}
        <Reanimated.default.View style={[styles.rowContainer, rowStyle]}>
          <Pressable
            pointerEvents={actionsEnabled ? 'none' : undefined}
            onPress={actionsEnabled ? closeSelf : undefined}
          >
            {children}
          </Pressable>
        </Reanimated.default.View>
      </View>
    </GestureDetector>
  )
})

// A row swipe container. Shows an action which triggers on a full swipe
export const SwipeTrigger = React.memo(function SwipeTrigger(p: {
  children: React.ReactNode
  actionWidth: number
  makeAction: () => React.ReactNode
  onSwiped: () => void
}) {
  const pan = React.useRef(new Animated.ValueXY()).current
  const [hasSwiped, setHasSwiped] = React.useState(false)
  const {children, makeAction, onSwiped} = p
  const resetPosition = React.useCallback(() => {
    setHasSwiped(false)
    Animated.timing(pan, {
      duration: 200,
      toValue: {x: 0, y: 0},
      useNativeDriver: true,
    }).start()
  }, [pan])

  const threshold = 40
  const running = React.useRef(false)
  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        running.current = true
        const val = -gestureState.dx > threshold
        return val
      },
      onPanResponderGrant: () => {
        pan.setOffset({x: 0, y: 0})
        pan.setValue({x: 0, y: 0})
        setHasSwiped(true)
      },
      onPanResponderMove: (_, gesture) => {
        pan.setValue({x: Math.min(gesture.dx, 0), y: 0})
      },
      onPanResponderRelease: () => {
        if (!running.current) {
          return
        }
        running.current = false
        pan.flattenOffset()
        // only swipe if its actually still over
        // _value does exist, TODO maybe use addlistener instead or similar
        const px = pan.x as any as {_value: number}
        const val = -px._value
        if (val > threshold) {
          onSwiped()
        }
        resetPosition()
      },
      onPanResponderTerminate: () => {
        if (!running.current) {
          return
        }
        running.current = false
        // _value does exist, TODO maybe use addlistener instead or similar
        const px = pan.x as any as {_value: number}
        const val = -px._value
        if (val > threshold) {
          onSwiped()
        }
        resetPosition()
      },
      onStartShouldSetPanResponder: () => false,
    })
  ).current

  const action = React.useMemo(() => {
    return hasSwiped ? makeAction() : null
  }, [makeAction, hasSwiped])

  return (
    <View style={styles.container}>
      {action ? <Animated.View style={[styles.actionContainerTrigger]}>{action}</Animated.View> : null}
      <Animated.View
        style={[styles.rowContainer, {transform: [{translateX: pan.x}]}]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  )
})

const styles = StyleSheet.create({
  actionContainer: {
    alignSelf: 'flex-end',
    height: '100%',
    overflow: 'hidden',
    position: 'absolute',
  },
  actionContainerTrigger: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'absolute',
  },
  container: {
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  rowContainer: {width: '100%'},
})
