/* eslint-disable react-hooks/immutability */
import {useState} from 'react'
import {
  withTiming,
  cancelAnimation,
  runOnJS,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
import type {GestureTouchEvent, GestureUpdateEvent, PinchGestureHandlerEventPayload, LegacyGestureStateManager} from 'react-native-gesture-handler'

import {clamp} from '../utils/clamp'
import {useVector} from './useVector'
import {pinchTransform} from '../utils/pinchTransform'

import type {BoundsFuction, SizeVector, Vector, PinchGestureEvent, ScaleMode, PinchMode} from '../../types'

type PinchGestureEventCallback = (e: PinchGestureEvent) => void

type PinchOptions = {
  container: SizeVector<SharedValue<number>>
  translate: Vector<SharedValue<number>>
  offset: Vector<SharedValue<number>>
  scale: SharedValue<number>
  scaleOffset: SharedValue<number>
  scaleMode: ScaleMode
  minScale: number
  maxScale: SharedValue<number>
  boundFn: BoundsFuction
  pinchMode: PinchMode
  allowPinchPanning: boolean
  userCallbacks: Partial<{
    onGestureEnd: () => void
    onPinchStart: PinchGestureEventCallback
    onPinchEnd: PinchGestureEventCallback
  }>
}

type PinchGestueUpdateEvent = GestureUpdateEvent<PinchGestureHandlerEventPayload>

export const usePinchCommons = (options: PinchOptions) => {
  // vendored reanimated gesture code; shared-value writes during render are intentional
  'use no memo'
  const {
    container,
    translate,
    offset,
    scale,
    scaleOffset,
    minScale,
    maxScale,
    scaleMode,
    pinchMode,
    allowPinchPanning,
    boundFn,
    userCallbacks,
  } = options

  const pinchClamp = pinchMode === 'clamp'
  const scaleClamp = scaleMode === 'clamp'

  const initialFocal = useVector(0, 0)
  const currentFocal = useVector(0, 0)
  const origin = useVector(0, 0)
  const gestureEnd = useSharedValue<number>(0)

  const [gesturesEnabled, setGesturesEnabled] = useState<boolean>(true)
  const switchGesturesState = (value: boolean) => {
    if (scaleMode !== 'bounce') return
    setGesturesEnabled(value)
  }

  const onTouchesDown = (_e: GestureTouchEvent, state: LegacyGestureStateManager) => {
    'worklet'
    if (_e.numberOfTouches === 2) {
      state.begin()
    }
  }

  const onTouchesUp = (e: GestureTouchEvent, state: LegacyGestureStateManager) => {
    'worklet'
    if (e.numberOfTouches !== 2) {
      state.end()
    }
  }

  const onTouchesMove = (e: GestureTouchEvent, state: LegacyGestureStateManager) => {
    'worklet'
    if (e.numberOfTouches !== 2) return
    const touchOne = e.allTouches[0]!
    const touchTwo = e.allTouches[1]!
    currentFocal.x.value = (touchOne.absoluteX + touchTwo.absoluteX) / 2
    currentFocal.y.value = (touchOne.absoluteY + touchTwo.absoluteY) / 2
    state.activate()
  }

  const onPinchStart = (e: PinchGestureEvent) => {
    'worklet'
    runOnJS(switchGesturesState)(false)
    if (userCallbacks.onPinchStart) runOnJS(userCallbacks.onPinchStart)(e)

    cancelAnimation(translate.x)
    cancelAnimation(translate.y)
    cancelAnimation(scale)

    initialFocal.x.value = currentFocal.x.value
    initialFocal.y.value = currentFocal.y.value

    origin.x.value = e.focalX - container.width.value / 2
    origin.y.value = e.focalY - container.height.value / 2

    offset.x.value = translate.x.value
    offset.y.value = translate.y.value
    scaleOffset.value = scale.value
  }

  const onPinchUpdate = (e: PinchGestueUpdateEvent) => {
    'worklet'
    let toScale = e.scale * scaleOffset.value
    if (scaleClamp) toScale = clamp(toScale, minScale, maxScale.value)

    const deltaX = currentFocal.x.value - initialFocal.x.value
    const deltaY = currentFocal.y.value - initialFocal.y.value

    const {x: toX, y: toY} = pinchTransform({
      toScale,
      fromScale: scaleOffset.value,
      origin: {x: origin.x.value, y: origin.y.value},
      offset: {x: offset.x.value, y: offset.y.value},
      delta: {
        x: allowPinchPanning ? deltaX : 0,
        y: allowPinchPanning ? deltaY : 0,
      },
    })

    const {x: boundX, y: boundY} = boundFn(toScale)
    const clampedX = clamp(toX, -1 * boundX, boundX)
    const clampedY = clamp(toY, -1 * boundY, boundY)

    translate.x.value = pinchClamp ? clampedX : toX
    translate.y.value = pinchClamp ? clampedY : toY
    scale.value = toScale
  }

  const reset = (toX: number, toY: number, toScale: number) => {
    'worklet'
    cancelAnimation(translate.x)
    cancelAnimation(translate.y)
    cancelAnimation(scale)

    const areTXNotEqual = translate.x.value !== toX
    const areTYNotEqual = translate.y.value !== toY
    const areScalesNotEqual = scale.value !== toScale
    const toValue = areTXNotEqual || areTYNotEqual || areScalesNotEqual ? 1 : 0

    translate.x.value = withTiming(toX)
    translate.y.value = withTiming(toY)
    // Patch: removed scaleOffset.value = scale.value here (caused double-pinch bug)
    scale.value = withTiming(toScale, undefined, (finished: boolean | undefined) => {
      if (finished) runOnJS(switchGesturesState)(true)
    })

    gestureEnd.value = withTiming(toValue, undefined, (finished: boolean | undefined) => {
      gestureEnd.value = 0
      if (finished && userCallbacks.onGestureEnd !== undefined) {
        runOnJS(userCallbacks.onGestureEnd)()
      }
    })
  }

  const onPinchEnd = (e: PinchGestureEvent) => {
    'worklet'
    if (userCallbacks.onPinchEnd) runOnJS(userCallbacks.onPinchEnd)(e)

    const toScale = clamp(scale.value, minScale, maxScale.value)
    const deltaY =
      !scaleClamp && allowPinchPanning && scale.value > maxScale.value
        ? (currentFocal.y.value - initialFocal.y.value) / 2
        : 0

    const {x, y} = pinchTransform({
      toScale,
      fromScale: scale.value,
      origin: {x: origin.x.value, y: origin.y.value},
      offset: {x: translate.x.value, y: translate.y.value},
      delta: {x: 0, y: deltaY},
    })

    const {x: boundX, y: boundY} = boundFn(toScale)
    const toX = clamp(x, -1 * boundX, boundX)
    const toY = clamp(y, -1 * boundY, boundY)

    reset(toX, toY, toScale)
  }

  return {
    gesturesEnabled,
    onTouchesDown,
    onTouchesMove,
    onTouchesUp,
    onPinchStart,
    onPinchUpdate,
    onPinchEnd,
  }
}
