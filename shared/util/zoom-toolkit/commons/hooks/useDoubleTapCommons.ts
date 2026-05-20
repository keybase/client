import {runOnJS, withTiming, type SharedValue} from 'react-native-reanimated'
import {pinchTransform} from '../utils/pinchTransform'
import {clamp} from '../utils/clamp'
import type {BoundsFuction, SizeVector, TapGestureEvent, Vector} from '../../types'
import {useState} from 'react'

type DoubleTapOptions = {
  container: SizeVector<SharedValue<number>>
  translate: Vector<SharedValue<number>>
  scale: SharedValue<number>
  minScale: number
  maxScale: SharedValue<number>
  scaleOffset: SharedValue<number>
  boundsFn: BoundsFuction
  onGestureEnd?: () => void
}

export const useDoubleTapCommons = ({
  container,
  translate,
  scale,
  minScale,
  maxScale,
  scaleOffset,
  boundsFn,
  onGestureEnd,
}: DoubleTapOptions) => {
  const [isPanGestureEnabled, setIsPanGestureEnabled] = useState<boolean>(true)

  const onDoubleTapStart = () => {
    'worklet'
    runOnJS(setIsPanGestureEnabled)(false)
  }

  const onDoubleTapEnd = (event: TapGestureEvent) => {
    'worklet'
    const originX = event.x - container.width.value / 2
    const originY = event.y - container.height.value / 2
    // Patch: exact equality check so double-tap reliably toggles zoom in/out
    const toScale = scale.value === minScale ? maxScale.value : minScale

    const {x, y} = pinchTransform({
      toScale,
      fromScale: scale.value,
      origin: {x: originX, y: originY},
      delta: {x: 0, y: 0},
      offset: {x: translate.x.value, y: translate.y.value},
    })

    const {x: boundX, y: boundY} = boundsFn(toScale)
    const toX = clamp(x, -1 * boundX, boundX)
    const toY = clamp(y, -1 * boundY, boundY)

    translate.x.value = withTiming(toX)
    translate.y.value = withTiming(toY)
    scaleOffset.value = toScale
    scale.value = withTiming(toScale, undefined, finished => {
      runOnJS(setIsPanGestureEnabled)(true)
      finished && onGestureEnd && runOnJS(onGestureEnd)()
    })
  }

  return {
    onDoubleTapStart,
    onDoubleTapEnd,
    enablePanGestureByDoubleTap: isPanGestureEnabled,
  }
}
