import * as React from 'react'
import {StyleSheet, View, Pressable, Animated, PanResponder} from 'react-native'
import {
  PanGestureHandlerEventPayload,
  Gesture,
  GestureUpdateEvent,
  GestureDetector,
} from 'react-native-gesture-handler'
import * as Styles from '../styles'
import {colors, darkColors} from '../styles/colors'
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
          stiffness: 300,
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
  closeSelf: () => void,
  extraData: unknown,
  onClick?: () => void
) => {
  const started = Reanimated.useSharedValue(false)
  const lastIsOpen = Reanimated.useSharedValue(false)
  const [isOpen, setIsOpen] = React.useState(false)
  const startx = Reanimated.useSharedValue(0)
  const dx = Reanimated.useSharedValue(0)
  const [lastED, setLastED] = React.useState(extraData)

  // parent is different, close immediately
  if (lastED !== extraData) {
    setLastED(extraData)
    startx.value = 0
    dx.value = 0
    Reanimated.cancelAnimation(tx)
    tx.value = 0
  }

  Reanimated.useDerivedValue(() => {
    const nextIsOpen = tx.value < 0
    if (lastIsOpen.value !== nextIsOpen) {
      lastIsOpen.value = nextIsOpen
      Reanimated.runOnJS(setIsOpen)(nextIsOpen)
    }
  })

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .minPointers(1)
    .maxPointers(1)
    .onStart(() => {
      Reanimated.cancelAnimation(tx)
      startx.value = tx.value
      dx.value = 0
      started.value = true
      Reanimated.runOnJS(closeOthersAndRegisterClose)()
    })
    .onFinalize((_e, success) => {
      if (!started.value) {
        return
      }
      const closing = dx.value >= 0
      if (!success || closing) {
        startx.value = 0
        Reanimated.cancelAnimation(tx)
        tx.value = 0
        Reanimated.runOnJS(closeSelf)()
      } else {
        tx.value = Reanimated.withSpring(-actionWidth, {
          stiffness: 100,
          damping: 30,
        })
        startx.value = -actionWidth
      }

      dx.value = 0
      started.value = false
    })
    .onUpdate((e: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
      dx.value = e.velocityX
      tx.value = Math.min(0, Math.max(-actionWidth, e.translationX + startx.value))
    })

  const tapGesture = Gesture.Tap()
    .onStart(() => {})
    .onEnd(() => {
      if (isOpen) {
        return
      }
      onClick && Reanimated.runOnJS(onClick)()
    })
    .enabled(!isOpen)

  return Gesture.Race(panGesture, tapGesture)
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
  const rowStyle = Reanimated.useAnimatedStyle(() => ({
    backgroundColor: tx.value < 0 ? solidColor : clearColor,
    transform: [{translateX: tx.value}],
  }))
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
  const [hasSwiped, setHasSwiped] = React.useState(false)
  const {children, makeAction, onSwiped} = p
  const resetPosition = React.useCallback(() => {
    setHasSwiped(false)
    Animated.timing(pan, {
      toValue: {x: 0, y: 0},
      duration: 200,
      useNativeDriver: true,
    }).start()
  }, [])

  const threshold = 40
  const running = React.useRef(false)
  const pan = React.useRef(new Animated.ValueXY()).current
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
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
        // @ts-ignore _value does exist
        const val = -pan.x._value
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
        // @ts-ignore _value does exist
        const val = -pan.x._value
        if (val > threshold) {
          onSwiped()
        }
        resetPosition()
      },
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
  container: {
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
    flexDirection: 'column',
  },
  rowContainer: {width: '100%'},
  actionContainerTrigger: {
    position: 'absolute',
    alignSelf: 'flex-end',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    height: '100%',
  },
  actionContainer: {
    position: 'absolute',
    alignSelf: 'flex-end',
    overflow: 'hidden',
    height: '100%',
  },
})
