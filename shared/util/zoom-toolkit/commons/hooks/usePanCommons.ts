import {
  cancelAnimation,
  withTiming,
  useSharedValue,
  withDecay,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated'
import type {
  GestureUpdateEvent,
  PanGestureChangeEventPayload,
  PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler'

import {clamp} from '../utils/clamp'
import {useVector} from './useVector'
import {friction} from '../utils/friction'
import {getSwipeDirection} from '../utils/getSwipeDirection'

import type {PanMode, BoundsFuction, Vector, SizeVector, PanGestureEvent, SwipeDirection} from '../../types'

type PanGestureEventCallback = (e: PanGestureEvent) => void

type PanCommmonOptions = {
  container: SizeVector<SharedValue<number>>
  translate: Vector<SharedValue<number>>
  offset: Vector<SharedValue<number>>
  panMode: PanMode
  decay?: boolean
  boundFn: BoundsFuction
  userCallbacks: Partial<{
    onGestureEnd: () => void
    onPanStart: PanGestureEventCallback
    onPanEnd: PanGestureEventCallback
    onSwipe: (direction: SwipeDirection) => void
    onOverPanning: (x: number, y: number) => void
  }>
}

type PanGestureUpdadeEvent = GestureUpdateEvent<PanGestureHandlerEventPayload & PanGestureChangeEventPayload>

export const usePanCommons = (options: PanCommmonOptions) => {
  const {container, translate, offset, panMode, decay, boundFn, userCallbacks} = options
  const {onSwipe, onGestureEnd, onOverPanning} = userCallbacks

  const time = useSharedValue<number>(0)
  const position = useVector(0, 0)
  const gestureEnd = useSharedValue<number>(0)
  const isWithinBoundX = useSharedValue<boolean>(true)
  const isWithinBoundY = useSharedValue<boolean>(true)

  const onPanStart = (e: PanGestureEvent) => {
    'worklet'
    if (userCallbacks.onPanStart) runOnJS(userCallbacks.onPanStart)(e)
    cancelAnimation(translate.x)
    cancelAnimation(translate.y)
    offset.x.set(translate.x.value)
    offset.y.set(translate.y.value)
    time.set(performance.now())
    position.x.set(e.absoluteX)
    position.y.set(e.absoluteY)
  }

  const onPanChange = (e: PanGestureUpdadeEvent) => {
    'worklet'
    const toX = e.translationX + offset.x.value
    const toY = e.translationY + offset.y.value
    const {x: boundX, y: boundY} = boundFn()
    const exceedX = Math.max(0, Math.abs(toX) - boundX)
    const exceedY = Math.max(0, Math.abs(toY) - boundY)
    isWithinBoundX.set(exceedX === 0)
    isWithinBoundY.set(exceedY === 0)

    if ((exceedX > 0 || exceedY > 0) && onOverPanning) {
      const ex = Math.sign(toX) * exceedX
      const ey = Math.sign(toY) * exceedY
      onOverPanning(ex, ey)
    }

    if (panMode !== 'friction') {
      const isFree = panMode === 'free'
      translate.x.set(isFree ? toX : clamp(toX, -1 * boundX, boundX))
      translate.y.set(isFree ? toY : clamp(toY, -1 * boundY, boundY))
      return
    }

    const overScrollFraction = Math.max(container.width.value, container.height.value) * 1.5

    if (isWithinBoundX.value) {
      translate.x.set(toX)
    } else {
      const fraction = Math.abs(Math.abs(toX) - boundX) / overScrollFraction
      const frictionX = friction(clamp(fraction, 0, 1))
      translate.x.set(translate.x.value + e.changeX * frictionX)
    }

    if (isWithinBoundY.value) {
      translate.y.set(toY)
    } else {
      const fraction = Math.abs(Math.abs(toY) - boundY) / overScrollFraction
      const frictionY = friction(clamp(fraction, 0, 1))
      translate.y.set(translate.y.value + e.changeY * frictionY)
    }
  }

  const onPanEnd = (e: PanGestureEvent) => {
    'worklet'
    if (panMode === 'clamp' && onSwipe) {
      const boundaries = boundFn()
      const direction = getSwipeDirection(e, {
        boundaries,
        time: time.value,
        position: {x: position.x.value, y: position.y.value},
        translate: {x: translate.x.value, y: translate.y.value},
      })
      if (direction !== undefined) {
        runOnJS(onSwipe)(direction)
        return
      }
    }

    if (userCallbacks.onPanEnd) runOnJS(userCallbacks.onPanEnd)(e)

    const {x: boundX, y: boundY} = boundFn()
    const clampX: [number, number] = [-1 * boundX, boundX]
    const clampY: [number, number] = [-1 * boundY, boundY]
    const toX = clamp(translate.x.value, -1 * boundX, boundX)
    const toY = clamp(translate.y.value, -1 * boundY, boundY)
    const decayX = decay && isWithinBoundX.value
    const decayY = decay && isWithinBoundY.value
    const decayConfigX = {velocity: e.velocityX, clamp: clampX}
    const decayConfigY = {velocity: e.velocityY, clamp: clampY}

    translate.x.set(decayX ? withDecay(decayConfigX) : withTiming(toX))
    translate.y.set(decayY ? withDecay(decayConfigY) : withTiming(toY))

    const restX = Math.abs(Math.abs(translate.x.value) - boundX)
    const restY = Math.abs(Math.abs(translate.y.value) - boundY)
    gestureEnd.set(restX > restY ? translate.x.value : translate.y.value)

    if (decayX || decayY) {
      const config = restX > restY ? decayConfigX : decayConfigY
      gestureEnd.set(
        withDecay(config, (finished: boolean | undefined) => {
          if (finished && onGestureEnd) runOnJS(onGestureEnd)()
        })
      )
    } else {
      const toValue = restX > restY ? toX : toY
      gestureEnd.set(
        withTiming(toValue, undefined, (finished: boolean | undefined) => {
          if (finished && onGestureEnd) runOnJS(onGestureEnd)()
        })
      )
    }
  }

  return {onPanStart, onPanChange, onPanEnd}
}
