import * as React from 'react'
import {StyleSheet, View, Pressable, Animated, PanResponder} from 'react-native'
import {
  PanGestureHandlerEventPayload,
  Gesture,
  GestureUpdateEvent,
  GestureDetector,
} from 'react-native-gesture-handler'
import * as Styles from '../styles'
import * as Reanimated from 'react-native-reanimated'

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
  extraData: unknown
) => {
  const startx = Reanimated.useSharedValue(0)
  const dx = Reanimated.useSharedValue(0)

  // parent is different, close immediately
  React.useEffect(() => {
    startx.value = 0
    dx.value = 0
  }, [extraData])

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
        dx.value = 0
        Reanimated.runOnJS(closeSelf)()
      } else {
        tx.value = Reanimated.withSpring(-actionWidth, {
          stiffness: 100,
          damping: 30,
        })
        startx.value = tx.value
        dx.value = 0
      }
    })
    .onUpdate((e: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
      dx.value = e.velocityX
      tx.value = Math.min(0, Math.max(-actionWidth, e.translationX + startx.value))
    })
  return gesture
}

// A row swipe container. Shows actions below
export const Swipeable = React.memo(function Swipeable2(p: {
  children: React.ReactNode
  actionWidth: number
  makeActionsRef: React.MutableRefObject<(p: Reanimated.SharedValue<number>) => React.ReactNode>
  swipeCloseRef?: React.MutableRefObject<(() => void) | null>
  style?: Styles.StylesCrossPlatform
  extraData?: unknown
}) {
  const {children, actionWidth, makeActionsRef, swipeCloseRef, style, extraData} = p
  const tx = Reanimated.useSharedValue(0)
  const {actionsEnabled} = useActionsEnabled(actionWidth, tx)
  const rowStyle = Reanimated.useAnimatedStyle(() => ({transform: [{translateX: tx.value}]}))
  const actionStyle = Reanimated.useAnimatedStyle(() => ({width: -tx.value}))
  const {closeSelf, closeOthersAndRegisterClose, hasSwiped} = useSyncClosing(tx, swipeCloseRef)
  const gesture = useGesture(actionWidth, tx, closeOthersAndRegisterClose, closeSelf, extraData)
  const actions = hasSwiped ? makeActionsRef.current(tx) : null

  // parent is different, close immediately
  React.useEffect(() => {
    tx.value = 0
  }, [extraData])

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
  const pan = React.useRef(new Animated.ValueXY()).current
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => -gestureState.dx > threshold,
      onPanResponderGrant: () => {
        pan.setOffset({x: 0, y: 0})
        pan.setValue({x: 0, y: 0})
        setHasSwiped(true)
      },
      onPanResponderMove: (_, gesture) => {
        pan.setValue({x: Math.min(gesture.dx, 0), y: 0})
      },
      onPanResponderRelease: () => {
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
