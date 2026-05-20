# Replace react-native-zoom-toolkit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `react-native-zoom-toolkit` npm dep with an owned copy in `shared/util/zoom-toolkit/`, patching applied inline and unused props/features stripped.

**Architecture:** Copy only the source files needed by our two consumers (`zoomable-image.tsx` uses `ResumableZoom`, `fitContainer`, `useImageResolution`; `edit-avatar/index.tsx` uses `CropZoom`). Apply both existing patches inline. Strip unused props from the public API of both components while keeping all internal logic intact so gesture behavior is unchanged.

**Tech Stack:** TypeScript, React Native, react-native-reanimated, react-native-gesture-handler

---

## File Map

**Create (new module):**
- `shared/util/zoom-toolkit/types.ts` — all shared types
- `shared/util/zoom-toolkit/commons/utils/clamp.ts`
- `shared/util/zoom-toolkit/commons/utils/friction.ts`
- `shared/util/zoom-toolkit/commons/utils/getMaxScale.ts`
- `shared/util/zoom-toolkit/commons/utils/getSwipeDirection.ts`
- `shared/util/zoom-toolkit/commons/utils/getVisibleRect.ts`
- `shared/util/zoom-toolkit/commons/utils/pinchTransform.ts`
- `shared/util/zoom-toolkit/commons/utils/crop.ts`
- `shared/util/zoom-toolkit/commons/utils/getCropRotatedSize.ts`
- `shared/util/zoom-toolkit/commons/hooks/useVector.ts`
- `shared/util/zoom-toolkit/commons/hooks/useSizeVector.ts`
- `shared/util/zoom-toolkit/commons/hooks/usePanCommons.ts`
- `shared/util/zoom-toolkit/commons/hooks/usePinchCommons.ts` — patch 2 applied
- `shared/util/zoom-toolkit/commons/hooks/useDoubleTapCommons.ts` — patch 1 applied
- `shared/util/zoom-toolkit/fitContainer.ts`
- `shared/util/zoom-toolkit/useImageResolution.ts`
- `shared/util/zoom-toolkit/ResumableZoom.tsx` — trimmed props, no forwardRef
- `shared/util/zoom-toolkit/CropZoom.tsx` — trimmed props, forwardRef inline
- `shared/util/zoom-toolkit/index.ts`

**Modify:**
- `shared/common-adapters/zoomable-image.tsx` — update import path
- `shared/profile/edit-avatar/index.tsx` — update import path
- `shared/package.json` — remove dep
- `shared/jest.config.js` — remove from transformIgnorePatterns
- `shared/native-only-modules.js` — remove from list

**Delete:**
- `shared/patches/react-native-zoom-toolkit+5.0.1.patch`

---

### Task 1: Create commons types

**Files:**
- Create: `shared/util/zoom-toolkit/types.ts`

- [ ] **Step 1: Create types.ts**

```typescript
// shared/util/zoom-toolkit/types.ts
import type {
  GestureStateChangeEvent,
  PinchGestureHandlerEventPayload,
  TapGestureHandlerEventPayload,
  PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler'

export type Rect = {x: number; y: number; width: number; height: number}
export type Vector<T> = {x: T; y: T}
export type SizeVector<T> = {width: T; height: T}
export type SwipeDirection = 'up' | 'down' | 'left' | 'right'
export type PanMode = 'clamp' | 'free' | 'friction'
export type ScaleMode = 'clamp' | 'bounce'
export type PinchMode = 'clamp' | 'free'

export type CommonTransformState<T> = {
  translateX: T
  translateY: T
  scale: T
}

export type CommonZoomState<T> = {
  containerSize: SizeVector<T>
  childSize: SizeVector<T>
  maxScale: T
} & CommonTransformState<T>

export type TapGestureEvent = GestureStateChangeEvent<TapGestureHandlerEventPayload>
export type PanGestureEvent = GestureStateChangeEvent<PanGestureHandlerEventPayload>
export type PinchGestureEvent = GestureStateChangeEvent<PinchGestureHandlerEventPayload>

export type BoundsFuction = (scale?: number) => Vector<number>
```

- [ ] **Step 2: Commit**

```bash
cd shared && git add util/zoom-toolkit/types.ts
git commit -m "add zoom-toolkit/types.ts"
```

---

### Task 2: Create commons utilities

**Files:**
- Create: `shared/util/zoom-toolkit/commons/utils/clamp.ts`
- Create: `shared/util/zoom-toolkit/commons/utils/friction.ts`
- Create: `shared/util/zoom-toolkit/commons/utils/getMaxScale.ts`
- Create: `shared/util/zoom-toolkit/commons/utils/getSwipeDirection.ts`
- Create: `shared/util/zoom-toolkit/commons/utils/getVisibleRect.ts`
- Create: `shared/util/zoom-toolkit/commons/utils/pinchTransform.ts`
- Create: `shared/util/zoom-toolkit/commons/utils/crop.ts`
- Create: `shared/util/zoom-toolkit/commons/utils/getCropRotatedSize.ts`

- [ ] **Step 1: Create clamp.ts**

```typescript
// shared/util/zoom-toolkit/commons/utils/clamp.ts
export const clamp = (value: number, min: number, max: number): number => {
  'worklet'
  return Math.max(min, Math.min(value, max))
}
```

- [ ] **Step 2: Create friction.ts**

```typescript
// shared/util/zoom-toolkit/commons/utils/friction.ts
export const friction = (overScrollFraction: number) => {
  'worklet'
  return 1 * Math.pow(1 - overScrollFraction, 2)
}
```

- [ ] **Step 3: Create getMaxScale.ts**

```typescript
// shared/util/zoom-toolkit/commons/utils/getMaxScale.ts
import type {SizeVector} from '../../types'

export const getMaxScale = (canvasSize: SizeVector<number>, resolution: SizeVector<number>): number => {
  'worklet'
  if (resolution.width > resolution.height) {
    return Math.max(1, resolution.width / canvasSize.width)
  }
  return Math.max(1, resolution.height / canvasSize.height)
}
```

- [ ] **Step 4: Create getSwipeDirection.ts**

```typescript
// shared/util/zoom-toolkit/commons/utils/getSwipeDirection.ts
import type {PanGestureEvent, SwipeDirection, Vector} from '../../types'

type SwipeOptions = {
  time: number
  boundaries: Vector<number>
  position: Vector<number>
  translate: Vector<number>
}

const SWIPE_TIME = 175
const SWIPE_VELOCITY = 500
const SWIPE_DISTANCE = 20

export const getSwipeDirection = (e: PanGestureEvent, options: SwipeOptions): SwipeDirection | undefined => {
  'worklet'
  const {time, boundaries, position, translate} = options
  const deltaTime = performance.now() - time
  const {x: boundX, y: boundY} = boundaries

  const swipedDistanceX = Math.abs(position.x - e.absoluteX) >= SWIPE_DISTANCE
  const swipedDistanceY = Math.abs(position.y - e.absoluteY) >= SWIPE_DISTANCE
  const swipedInTime = deltaTime <= SWIPE_TIME

  const swipeRight = e.velocityX >= SWIPE_VELOCITY && swipedDistanceX && swipedInTime
  const inRightBound = translate.x === boundX
  if (swipeRight && inRightBound) return 'right'

  const swipeLeft = e.velocityX <= -1 * SWIPE_VELOCITY && swipedDistanceX && swipedInTime
  const inLeftBound = translate.x === -1 * boundX
  if (swipeLeft && inLeftBound) return 'left'

  const swipeUp = e.velocityY <= -1 * SWIPE_VELOCITY && swipedDistanceY && swipedInTime
  const inUpperBound = translate.y === -1 * boundY
  if (swipeUp && inUpperBound) return 'up'

  const swipeDown = e.velocityY >= SWIPE_VELOCITY && swipedDistanceY && swipedInTime
  const inLowerBound = translate.y === boundY
  if (swipeDown && inLowerBound) return 'down'

  return undefined
}
```

- [ ] **Step 5: Create getVisibleRect.ts**

```typescript
// shared/util/zoom-toolkit/commons/utils/getVisibleRect.ts
import type {SizeVector, Vector, Rect} from '../../types'

type Options = {
  scale: number
  translation: Vector<number>
  itemSize: SizeVector<number>
  containerSize: SizeVector<number>
}

export const getVisibleRect = (options: Options): Rect => {
  'worklet'
  const {scale, translation, itemSize, containerSize} = options

  const offsetX = (itemSize.width * scale - containerSize.width) / 2
  const offsetY = (itemSize.height * scale - containerSize.height) / 2
  const clampedX = Math.max(offsetX, 0)
  const clampedY = Math.max(offsetY, 0)

  const reducerX = (-1 * translation.x + clampedX) / (itemSize.width * scale)
  const reducerY = (-1 * translation.y + clampedY) / (itemSize.height * scale)

  const x = itemSize.width * reducerX
  const y = itemSize.height * reducerY
  const width = itemSize.width * Math.min(1, containerSize.width / (itemSize.width * scale))
  const height = itemSize.height * Math.min(1, containerSize.height / (itemSize.height * scale))

  return {x, y, width, height}
}
```

- [ ] **Step 6: Create pinchTransform.ts**

```typescript
// shared/util/zoom-toolkit/commons/utils/pinchTransform.ts
import type {Vector} from '../../types'

type PinchOptions = {
  toScale: number
  fromScale: number
  origin: Vector<number>
  delta: Vector<number>
  offset: Vector<number>
}

export const pinchTransform = (options: PinchOptions): Vector<number> => {
  'worklet'
  const {toScale, fromScale, delta, origin, offset} = options

  const fromPinchX = -1 * (origin.x * fromScale - origin.x)
  const fromPinchY = -1 * (origin.y * fromScale - origin.y)
  const toPinchX = -1 * (origin.x * toScale - origin.x)
  const toPinchY = -1 * (origin.y * toScale - origin.y)

  const x = offset.x + toPinchX - fromPinchX + delta.x
  const y = offset.y + toPinchY - fromPinchY + delta.y
  return {x, y}
}
```

- [ ] **Step 7: Create crop.ts**

```typescript
// shared/util/zoom-toolkit/commons/utils/crop.ts
import {getVisibleRect} from './getVisibleRect'
import type {SizeVector, Vector} from '../../types'

type CanvasToSizeOptions = {
  scale: number
  cropSize: SizeVector<number>
  itemSize: SizeVector<number>
  resolution: SizeVector<number>
  translation: Vector<number>
  isRotated: boolean
  fixedWidth?: number
}

export const crop = (options: CanvasToSizeOptions) => {
  'worklet'
  const {cropSize, itemSize, resolution, translation, scale, isRotated, fixedWidth} = options

  const rect = getVisibleRect({
    scale,
    containerSize: cropSize,
    itemSize: {
      width: isRotated ? itemSize.height : itemSize.width,
      height: isRotated ? itemSize.width : itemSize.height,
    },
    translation,
  })

  const relativeScale = resolution.width / itemSize.width
  const x = rect.x * relativeScale
  const y = rect.y * relativeScale
  const width = rect.width * relativeScale
  const height = rect.height * relativeScale

  let sizeModifier = 1
  let resize: SizeVector<number> | undefined
  if (fixedWidth !== undefined) {
    sizeModifier = fixedWidth / width
    resize = {
      width: Math.ceil(resolution.width * sizeModifier),
      height: Math.ceil(resolution.height * sizeModifier),
    }
  }

  return {
    crop: {
      originX: x * sizeModifier,
      originY: y * sizeModifier,
      width: Math.floor(width * sizeModifier),
      height: Math.floor(height * sizeModifier),
    },
    resize,
  }
}
```

- [ ] **Step 8: Create getCropRotatedSize.ts**

```typescript
// shared/util/zoom-toolkit/commons/utils/getCropRotatedSize.ts
import type {SizeVector} from '../../types'

type Options = {
  crop: SizeVector<number>
  resolution: SizeVector<number>
  angle: number
}

export const getRatioSize = (
  aspectRatio: number,
  container: Partial<SizeVector<number>>
): SizeVector<number> => {
  'worklet'
  if (container.width !== undefined) {
    return {width: container.width, height: container.width / aspectRatio}
  }
  return {width: container.height! * aspectRatio, height: container.height!}
}

export const getCropRotatedSize = (options: Options): SizeVector<number> => {
  'worklet'
  const {crop, angle, resolution} = options
  const cropAspectRatio = crop.width / crop.height
  let base = crop

  const flipped = angle % Math.PI === 0
  const aspectRatio = resolution.width / resolution.height
  const inverseAspectRatio = resolution.height / resolution.width

  const currentAspectRatio = flipped ? aspectRatio : inverseAspectRatio
  base = getRatioSize(currentAspectRatio, {
    width: cropAspectRatio >= 1 ? undefined : crop.width,
    height: cropAspectRatio >= 1 ? crop.height : undefined,
  })

  let sizeModifier = 1
  if (base.height < crop.height) sizeModifier = crop.height / base.height
  if (base.width < crop.width) sizeModifier = crop.width / base.width
  base.width = base.width * sizeModifier
  base.height = base.height * sizeModifier

  const maxWidth = Math.abs(base.height * Math.sin(angle)) + Math.abs(base.width * Math.cos(angle))
  const maxHeight = Math.abs(base.height * Math.cos(angle)) + Math.abs(base.width * Math.sin(angle))

  return getRatioSize(aspectRatio, {
    width: aspectRatio >= 1 ? undefined : maxWidth,
    height: aspectRatio >= 1 ? maxHeight : undefined,
  })
}
```

- [ ] **Step 9: Commit**

```bash
cd shared && git add util/zoom-toolkit/commons/utils/
git commit -m "add zoom-toolkit commons utils"
```

---

### Task 3: Create commons hooks (with patches applied)

**Files:**
- Create: `shared/util/zoom-toolkit/commons/hooks/useVector.ts`
- Create: `shared/util/zoom-toolkit/commons/hooks/useSizeVector.ts`
- Create: `shared/util/zoom-toolkit/commons/hooks/usePanCommons.ts`
- Create: `shared/util/zoom-toolkit/commons/hooks/usePinchCommons.ts`
- Create: `shared/util/zoom-toolkit/commons/hooks/useDoubleTapCommons.ts`

- [ ] **Step 1: Create useVector.ts and useSizeVector.ts**

```typescript
// shared/util/zoom-toolkit/commons/hooks/useVector.ts
import {useSharedValue, type SharedValue} from 'react-native-reanimated'
import type {Vector} from '../../types'

export const useVector = (x: number, y: number): Vector<SharedValue<number>> => {
  const first = useSharedValue<number>(x)
  const second = useSharedValue<number>(y)
  return {x: first, y: second}
}
```

```typescript
// shared/util/zoom-toolkit/commons/hooks/useSizeVector.ts
import {useSharedValue, type SharedValue} from 'react-native-reanimated'
import type {SizeVector} from '../../types'

export const useSizeVector = (x: number, y: number): SizeVector<SharedValue<number>> => {
  const first = useSharedValue<number>(x)
  const second = useSharedValue<number>(y)
  return {width: first, height: second}
}
```

- [ ] **Step 2: Create usePanCommons.ts (verbatim copy)**

```typescript
// shared/util/zoom-toolkit/commons/hooks/usePanCommons.ts
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
    userCallbacks.onPanStart && runOnJS(userCallbacks.onPanStart)(e)
    cancelAnimation(translate.x)
    cancelAnimation(translate.y)
    offset.x.value = translate.x.value
    offset.y.value = translate.y.value
    time.value = performance.now()
    position.x.value = e.absoluteX
    position.y.value = e.absoluteY
  }

  const onPanChange = (e: PanGestureUpdadeEvent) => {
    'worklet'
    const toX = e.translationX + offset.x.value
    const toY = e.translationY + offset.y.value
    const {x: boundX, y: boundY} = boundFn()
    const exceedX = Math.max(0, Math.abs(toX) - boundX)
    const exceedY = Math.max(0, Math.abs(toY) - boundY)
    isWithinBoundX.value = exceedX === 0
    isWithinBoundY.value = exceedY === 0

    if ((exceedX > 0 || exceedY > 0) && onOverPanning) {
      const ex = Math.sign(toX) * exceedX
      const ey = Math.sign(toY) * exceedY
      onOverPanning(ex, ey)
    }

    if (panMode !== 'friction') {
      const isFree = panMode === 'free'
      translate.x.value = isFree ? toX : clamp(toX, -1 * boundX, boundX)
      translate.y.value = isFree ? toY : clamp(toY, -1 * boundY, boundY)
      return
    }

    const overScrollFraction = Math.max(container.width.value, container.height.value) * 1.5

    if (isWithinBoundX.value) {
      translate.x.value = toX
    } else {
      const fraction = Math.abs(Math.abs(toX) - boundX) / overScrollFraction
      const frictionX = friction(clamp(fraction, 0, 1))
      translate.x.value += e.changeX * frictionX
    }

    if (isWithinBoundY.value) {
      translate.y.value = toY
    } else {
      const fraction = Math.abs(Math.abs(toY) - boundY) / overScrollFraction
      const frictionY = friction(clamp(fraction, 0, 1))
      translate.y.value += e.changeY * frictionY
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

    userCallbacks.onPanEnd && runOnJS(userCallbacks.onPanEnd)(e)

    const {x: boundX, y: boundY} = boundFn()
    const clampX: [number, number] = [-1 * boundX, boundX]
    const clampY: [number, number] = [-1 * boundY, boundY]
    const toX = clamp(translate.x.value, -1 * boundX, boundX)
    const toY = clamp(translate.y.value, -1 * boundY, boundY)
    const decayX = decay && isWithinBoundX.value
    const decayY = decay && isWithinBoundY.value
    const decayConfigX = {velocity: e.velocityX, clamp: clampX}
    const decayConfigY = {velocity: e.velocityY, clamp: clampY}

    translate.x.value = decayX ? withDecay(decayConfigX) : withTiming(toX)
    translate.y.value = decayY ? withDecay(decayConfigY) : withTiming(toY)

    const restX = Math.abs(Math.abs(translate.x.value) - boundX)
    const restY = Math.abs(Math.abs(translate.y.value) - boundY)
    gestureEnd.value = restX > restY ? translate.x.value : translate.y.value

    if (decayX || decayY) {
      const config = restX > restY ? decayConfigX : decayConfigY
      gestureEnd.value = withDecay(config, finished => {
        finished && onGestureEnd && runOnJS(onGestureEnd)()
      })
    } else {
      const toValue = restX > restY ? toX : toY
      gestureEnd.value = withTiming(toValue, undefined, finished => {
        finished && onGestureEnd && runOnJS(onGestureEnd)()
      })
    }
  }

  return {onPanStart, onPanChange, onPanEnd}
}
```

- [ ] **Step 3: Create usePinchCommons.ts (patch 2 applied: `scaleOffset.value = scale.value` line removed)**

The patch commented out `scaleOffset.value = scale.value;` in the `reset` function's `withTiming` callback. Our copy omits that line entirely.

```typescript
// shared/util/zoom-toolkit/commons/hooks/usePinchCommons.ts
import {useState} from 'react'
import {
  withTiming,
  cancelAnimation,
  runOnJS,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
import type {
  GestureStateManager,
  GestureTouchEvent,
  GestureUpdateEvent,
  PinchGestureHandlerEventPayload,
} from 'react-native-gesture-handler'

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

  const onTouchesDown = (e: GestureTouchEvent, state: GestureStateManager) => {
    'worklet'
    if (e.numberOfTouches === 2) {
      state.begin()
    }
  }

  const onTouchesUp = (e: GestureTouchEvent, state: GestureStateManager) => {
    'worklet'
    if (e.numberOfTouches !== 2) {
      state.end()
    }
  }

  const onTouchesMove = (e: GestureTouchEvent, state: GestureStateManager) => {
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
    userCallbacks.onPinchStart && runOnJS(userCallbacks.onPinchStart)(e)

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
    scale.value = withTiming(toScale, undefined, finished => {
      finished && runOnJS(switchGesturesState)(true)
    })

    gestureEnd.value = withTiming(toValue, undefined, finished => {
      gestureEnd.value = 0
      if (finished && userCallbacks.onGestureEnd !== undefined) {
        runOnJS(userCallbacks.onGestureEnd)()
      }
    })
  }

  const onPinchEnd = (e: PinchGestureEvent) => {
    'worklet'
    userCallbacks.onPinchEnd && runOnJS(userCallbacks.onPinchEnd)(e)

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
```

- [ ] **Step 4: Create useDoubleTapCommons.ts (patch 1 applied: toggle always resets vs fuzzy comparison)**

The patch changed `scale.value >= maxScale.value * 0.8 ? minScale : maxScale.value` to `scale.value === minScale ? maxScale.value : minScale`. Our copy uses the patched logic.

```typescript
// shared/util/zoom-toolkit/commons/hooks/useDoubleTapCommons.ts
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
```

- [ ] **Step 5: Commit**

```bash
cd shared && git add util/zoom-toolkit/commons/hooks/
git commit -m "add zoom-toolkit commons hooks with patches applied"
```

---

### Task 4: Create fitContainer and useImageResolution

**Files:**
- Create: `shared/util/zoom-toolkit/fitContainer.ts`
- Create: `shared/util/zoom-toolkit/useImageResolution.ts`

- [ ] **Step 1: Create fitContainer.ts**

```typescript
// shared/util/zoom-toolkit/fitContainer.ts
import type {SizeVector} from './types'

export const fitContainer = (aspectRatio: number, container: SizeVector<number>): SizeVector<number> => {
  'worklet'
  let width = container.width
  let height = container.width / aspectRatio

  if (height > container.height) {
    width = container.height * aspectRatio
    height = container.height
  }

  return {width, height}
}
```

- [ ] **Step 2: Create useImageResolution.ts**

```typescript
// shared/util/zoom-toolkit/useImageResolution.ts
import {useEffect, useState} from 'react'
import {Image} from 'react-native'
import type {SizeVector} from './types'

type Source = {uri: string; headers?: Record<string, string>}

export type FetchImageResolutionResult = {
  isFetching: boolean
  resolution: SizeVector<number> | undefined
  error: Error | undefined
}

export default function useImageResolution(source: Source | number): FetchImageResolutionResult {
  const [isFetching, setIsFetching] = useState<boolean>(true)
  const [error, setError] = useState<Error | undefined>(undefined)
  const [resolution, setResolution] = useState<SizeVector<number> | undefined>(undefined)

  const onSuccess = (width: number, height: number) => {
    setResolution({width, height})
    setIsFetching(false)
  }

  const onFailure = (e: Error) => {
    setError(e)
    setIsFetching(false)
  }

  const deps = JSON.stringify(source)
  useEffect(() => {
    setIsFetching(true)
    if (typeof source === 'number') {
      const {width, height} = Image.resolveAssetSource(source)
      onSuccess(width, height)
      return
    }
    if (source.headers === undefined) {
      Image.getSize(source.uri, onSuccess, onFailure)
      return
    }
    Image.getSizeWithHeaders(source.uri, source.headers, onSuccess, onFailure)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps])

  return {isFetching, resolution, error}
}
```

- [ ] **Step 3: Commit**

```bash
cd shared && git add util/zoom-toolkit/fitContainer.ts util/zoom-toolkit/useImageResolution.ts
git commit -m "add zoom-toolkit fitContainer and useImageResolution"
```

---

### Task 5: Create ResumableZoom (trimmed props)

**Files:**
- Create: `shared/util/zoom-toolkit/ResumableZoom.tsx`

Props kept: `style`, `extendGestures`, `maxScale` (number only), `panMode`, `onTap`, `onUpdate`, `onSwipe`, `children`.
Removed: all other callbacks, `longPress` gesture, imperative handle, forwardRef.
Defaults hardcoded: `decay=true`, `tapsEnabled=true`, `panEnabled=true`, `pinchEnabled=true`, `minScale=1`, `scaleMode='bounce'`, `pinchMode='clamp'`, `allowPinchPanning=true`.

- [ ] **Step 1: Create ResumableZoom.tsx**

```typescript
// shared/util/zoom-toolkit/ResumableZoom.tsx
import React from 'react'
import {StyleSheet, View, type LayoutChangeEvent} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'

import {clamp} from './commons/utils/clamp'
import {useVector} from './commons/hooks/useVector'
import {useSizeVector} from './commons/hooks/useSizeVector'
import {usePanCommons} from './commons/hooks/usePanCommons'
import {usePinchCommons} from './commons/hooks/usePinchCommons'
import {useDoubleTapCommons} from './commons/hooks/useDoubleTapCommons'
import type {BoundsFuction, CommonZoomState, PanMode, SizeVector, SwipeDirection, TapGestureEvent} from './types'

type ResumableZoomProps = {
  children: React.ReactNode
  style?: object
  extendGestures?: boolean
  maxScale?: number
  panMode?: PanMode
  onTap?: (e: TapGestureEvent) => void
  onUpdate?: (e: CommonZoomState<number>) => void
  onSwipe?: (direction: SwipeDirection) => void
}

const MIN_SCALE = 1

const ResumableZoom = (props: ResumableZoomProps) => {
  const {
    children,
    style,
    extendGestures = false,
    maxScale: userMaxScale = 6,
    panMode = 'clamp',
    onTap,
    onUpdate,
    onSwipe,
  } = props

  if (React.Children.count(children) !== 1) {
    throw new Error(`ResumableZoom expected one child but received ${React.Children.count(children)} children`)
  }

  const rootSize = useSizeVector(1, 1)
  const childSize = useSizeVector(1, 1)
  const extendedSize = useSizeVector(1, 1)

  const translate = useVector(0, 0)
  const offset = useVector(0, 0)
  const scale = useSharedValue<number>(MIN_SCALE)
  const scaleOffset = useSharedValue<number>(MIN_SCALE)

  const maxScale = useDerivedValue(() => userMaxScale, [userMaxScale])

  useDerivedValue(() => {
    extendedSize.width.value = extendGestures
      ? Math.max(rootSize.width.value, childSize.width.value)
      : childSize.width.value
    extendedSize.height.value = extendGestures
      ? Math.max(rootSize.height.value, childSize.height.value)
      : childSize.height.value
  }, [extendGestures, rootSize, childSize])

  const boundsFn: BoundsFuction = (optionalScale?: number) => {
    'worklet'
    const actualScale = optionalScale ?? scale.value
    const boundX = Math.max(0, childSize.width.value * actualScale - rootSize.width.value) / 2
    const boundY = Math.max(0, childSize.height.value * actualScale - rootSize.height.value) / 2
    return {x: boundX, y: boundY}
  }

  useDerivedValue(() => {
    onUpdate?.({
      containerSize: {width: rootSize.width.value, height: rootSize.height.value},
      childSize: {width: childSize.width.value, height: childSize.height.value},
      maxScale: maxScale.value,
      translateX: translate.x.value,
      translateY: translate.y.value,
      scale: scale.value,
    })
  }, [rootSize, childSize, translate, maxScale, scale])

  const {
    gesturesEnabled,
    onTouchesDown,
    onTouchesMove,
    onTouchesUp,
    onPinchStart,
    onPinchUpdate,
    onPinchEnd,
  } = usePinchCommons({
    container: extendedSize,
    translate,
    offset,
    scale,
    scaleOffset,
    minScale: MIN_SCALE,
    maxScale,
    allowPinchPanning: true,
    scaleMode: 'bounce',
    pinchMode: 'clamp',
    boundFn: boundsFn,
    userCallbacks: {},
  })

  const {onPanStart, onPanChange, onPanEnd} = usePanCommons({
    container: extendedSize,
    translate,
    offset,
    panMode,
    decay: true,
    boundFn: boundsFn,
    userCallbacks: {onSwipe},
  })

  const {onDoubleTapStart, onDoubleTapEnd, enablePanGestureByDoubleTap} = useDoubleTapCommons({
    container: extendedSize,
    translate,
    scale,
    minScale: MIN_SCALE,
    maxScale,
    scaleOffset,
    boundsFn,
  })

  const pinch = Gesture.Pinch()
    .withTestId('pinch')
    .enabled(true)
    .manualActivation(true)
    .onTouchesDown(onTouchesDown)
    .onTouchesMove(onTouchesMove)
    .onTouchesUp(onTouchesUp)
    .onStart(onPinchStart)
    .onUpdate(onPinchUpdate)
    .onEnd(onPinchEnd)

  const pan = Gesture.Pan()
    .withTestId('pan')
    .enabled(gesturesEnabled && enablePanGestureByDoubleTap)
    .maxPointers(1)
    .onStart(onPanStart)
    .onChange(onPanChange)
    .onEnd(onPanEnd)

  const tap = Gesture.Tap()
    .withTestId('tap')
    .enabled(gesturesEnabled)
    .maxDuration(250)
    .numberOfTaps(1)
    .runOnJS(true)
    .onEnd((e) => onTap?.(e))

  const doubleTap = Gesture.Tap()
    .withTestId('doubleTap')
    .enabled(gesturesEnabled)
    .maxDuration(250)
    .numberOfTaps(2)
    .onStart(onDoubleTapStart)
    .onEnd(onDoubleTapEnd)

  const measureRoot = (e: LayoutChangeEvent) => {
    rootSize.width.value = e.nativeEvent.layout.width
    rootSize.height.value = e.nativeEvent.layout.height
  }

  const measureChild = (e: LayoutChangeEvent) => {
    childSize.width.value = e.nativeEvent.layout.width
    childSize.height.value = e.nativeEvent.layout.height
  }

  const detectorStyle = useAnimatedStyle(() => ({
    width: extendedSize.width.value,
    height: extendedSize.height.value,
    transform: [
      {translateX: translate.x.value},
      {translateY: translate.y.value},
      {scale: scale.value},
    ],
  }), [extendedSize, translate, scale])

  const composedTap = Gesture.Exclusive(doubleTap, tap)
  const composedGesture = Gesture.Race(pinch, pan, composedTap)

  return (
    <View style={[style ?? styles.flex, styles.center]} onLayout={measureRoot}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View testID={'root'} style={[detectorStyle, styles.center]}>
          <Animated.View testID={'child'} onLayout={measureChild}>
            {children}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  center: {justifyContent: 'center', alignItems: 'center'},
})

export default ResumableZoom
```

- [ ] **Step 2: Commit**

```bash
cd shared && git add util/zoom-toolkit/ResumableZoom.tsx
git commit -m "add zoom-toolkit ResumableZoom (trimmed props, patches applied)"
```

---

### Task 6: Create CropZoom (trimmed props)

**Files:**
- Create: `shared/util/zoom-toolkit/CropZoom.tsx`

Props kept: `cropSize`, `resolution`, `panMode`, `minScale`, `children`.
Removed: `onUpdate`, `onGestureEnd`, `onPanStart`, `onPanEnd`, `onPinchStart`, `onPinchEnd`, `onTap`, `maxScale`, `scaleMode`, `allowPinchPanning`, `OverlayComponent`.
Ref type kept with only `crop()` method (what we actually call).
`React.forwardRef` used directly — no HOC wrapper.

- [ ] **Step 1: Create CropZoom.tsx**

`resetTo`, `setTransformState`, `canRotate`, `TAU`, and the reanimated `clamp` import are removed — they were only needed for rotation/flip methods that we don't expose. `RAD2DEG` is kept for the `crop()` context.

```typescript
// shared/util/zoom-toolkit/CropZoom.tsx
import React, {useImperativeHandle} from 'react'
import {StyleSheet, View, type LayoutChangeEvent, type ViewStyle} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'

import {crop} from './commons/utils/crop'
import {useSizeVector} from './commons/hooks/useSizeVector'
import {getCropRotatedSize} from './commons/utils/getCropRotatedSize'
import {usePanCommons} from './commons/hooks/usePanCommons'
import {usePinchCommons} from './commons/hooks/usePinchCommons'
import {getMaxScale} from './commons/utils/getMaxScale'
import {useVector} from './commons/hooks/useVector'
import type {BoundsFuction, PanMode, SizeVector} from './types'

const RAD2DEG = 180 / Math.PI

export type CropContextResult = {
  crop: {originX: number; originY: number; width: number; height: number}
  context: {rotationAngle: number; flipVertical: boolean; flipHorizontal: boolean}
  resize?: SizeVector<number>
}

export interface CropZoomRefType {
  crop: (fixedWidth?: number) => CropContextResult
}

type CropZoomProps = React.PropsWithChildren<{
  cropSize: SizeVector<number>
  resolution: SizeVector<number>
  panMode?: PanMode
  minScale?: number
}>

const CropZoomInner = (props: CropZoomProps & {reference?: React.ForwardedRef<CropZoomRefType>}) => {
  const {reference, children, cropSize, resolution, panMode = 'free', minScale = 1} = props

  const initialSize = getCropRotatedSize({crop: cropSize, resolution, angle: 0})

  const translate = useVector(0, 0)
  const offset = useVector(0, 0)
  const scale = useSharedValue<number>(minScale)
  const scaleOffset = useSharedValue<number>(minScale)
  const rotation = useSharedValue<number>(0)
  const rotate = useVector(0, 0)

  const rootSize = useSizeVector(0, 0)
  const childSize = useSizeVector(initialSize.width, initialSize.height)
  const gestureSize = useSizeVector(initialSize.width, initialSize.height)
  const sizeAngle = useSharedValue<number>(0)

  const maxScale = useDerivedValue(() => {
    return getMaxScale(
      {width: childSize.width.value, height: childSize.height.value},
      resolution
    )
  }, [childSize, resolution])

  useDerivedValue(() => {
    const size = getCropRotatedSize({crop: cropSize, resolution, angle: sizeAngle.value})

    let finalSize = 0
    const max = Math.max(rootSize.width.value, rootSize.height.value)
    if (childSize.width.value > childSize.height.value) {
      const sizeOffset = initialSize.width - cropSize.width
      finalSize = max + sizeOffset
    } else {
      const sizeOffset = initialSize.height - cropSize.height
      finalSize = max + sizeOffset
    }

    gestureSize.width.value = finalSize
    gestureSize.height.value = finalSize
    childSize.width.value = withTiming(size.width)
    childSize.height.value = withTiming(size.height)
  }, [rootSize, cropSize, resolution, childSize, sizeAngle])

  const boundsFn: BoundsFuction = (optionalScale?: number) => {
    'worklet'
    const scaleVal = optionalScale ?? scale.value
    let size = {width: childSize.width.value, height: childSize.height.value}

    const isInInverseAspectRatio = rotation.value % Math.PI !== 0
    if (isInInverseAspectRatio) {
      size = {width: size.height, height: size.width}
    }

    const boundX = Math.max(0, size.width * scaleVal - cropSize.width) / 2
    const boundY = Math.max(0, size.height * scaleVal - cropSize.height) / 2
    return {x: boundX, y: boundY}
  }

  function measureRootContainer(e: LayoutChangeEvent) {
    rootSize.width.value = e.nativeEvent.layout.width
    rootSize.height.value = e.nativeEvent.layout.height
  }

  const {
    gesturesEnabled,
    onTouchesDown,
    onTouchesMove,
    onTouchesUp,
    onPinchStart,
    onPinchUpdate,
    onPinchEnd,
  } = usePinchCommons({
    container: gestureSize,
    translate,
    offset,
    scale,
    scaleOffset,
    minScale,
    maxScale,
    allowPinchPanning: true,
    scaleMode: 'bounce',
    pinchMode: 'free',
    boundFn: boundsFn,
    userCallbacks: {},
  })

  const {onPanStart, onPanChange, onPanEnd} = usePanCommons({
    container: gestureSize,
    translate,
    offset,
    panMode,
    boundFn: boundsFn,
    userCallbacks: {},
  })

  const pinch = Gesture.Pinch()
    .withTestId('pinch')
    .manualActivation(true)
    .onTouchesDown(onTouchesDown)
    .onTouchesMove(onTouchesMove)
    .onTouchesUp(onTouchesUp)
    .onStart(onPinchStart)
    .onUpdate(onPinchUpdate)
    .onEnd(onPinchEnd)

  const pan = Gesture.Pan()
    .withTestId('pan')
    .enabled(gesturesEnabled)
    .maxPointers(1)
    .onStart(onPanStart)
    .onChange(onPanChange)
    .onEnd(onPanEnd)

  const detectorStyle = useAnimatedStyle(() => ({
    width: gestureSize.width.value,
    height: gestureSize.height.value,
    position: 'absolute',
    transform: [
      {translateX: translate.x.value},
      {translateY: translate.y.value},
      {scale: scale.value},
    ],
  }), [gestureSize, translate, scale])

  const childStyle = useAnimatedStyle(() => ({
    width: childSize.width.value,
    height: childSize.height.value,
    transform: [
      {translateX: translate.x.value},
      {translateY: translate.y.value},
      {scale: scale.value},
      {rotate: `${rotation.value}rad`},
      {rotateX: `${rotate.x.value}rad`},
      {rotateY: `${rotate.y.value}rad`},
    ],
  }), [childSize, translate, scale, rotation, rotate])

  const handleCrop = (fixedWidth?: number): CropContextResult => {
    const context: CropContextResult['context'] = {
      rotationAngle: rotation.value * RAD2DEG,
      flipHorizontal: rotate.y.value === Math.PI,
      flipVertical: rotate.x.value === Math.PI,
    }

    const result = crop({
      scale: scale.value,
      cropSize,
      resolution,
      itemSize: {width: childSize.width.value, height: childSize.height.value},
      translation: {x: translate.x.value, y: translate.y.value},
      isRotated: context.rotationAngle % 180 !== 0,
      fixedWidth,
    })

    return {crop: result.crop, resize: result.resize, context}
  }

  useImperativeHandle(reference, () => ({crop: handleCrop}))

  const rootStyle: ViewStyle = {minWidth: cropSize.width, minHeight: cropSize.height}

  return (
    <View style={[styles.root, rootStyle, styles.center]} onLayout={measureRootContainer}>
      <Animated.View style={childStyle}>{children}</Animated.View>
      <GestureDetector gesture={Gesture.Race(pinch, pan)}>
        <Animated.View style={detectorStyle} />
      </GestureDetector>
    </View>
  )
}

export const CropZoom = React.forwardRef<CropZoomRefType, CropZoomProps>((props, ref) => {
  const {minScale, children} = props

  if (minScale !== undefined && minScale < 1) {
    throw new Error('minScale property must be greater than or equals one')
  }

  return <CropZoomInner {...props} reference={ref}>{children}</CropZoomInner>
})

CropZoom.displayName = 'CropZoom'

const styles = StyleSheet.create({
  root: {flex: 1},
  center: {justifyContent: 'center', alignItems: 'center'},
})
```

- [ ] **Step 2: Commit**

```bash
cd shared && git add util/zoom-toolkit/CropZoom.tsx
git commit -m "add zoom-toolkit CropZoom (trimmed props, forwardRef inline)"
```

---

### Task 7: Create the module index

**Files:**
- Create: `shared/util/zoom-toolkit/index.ts`

- [ ] **Step 1: Create index.ts**

```typescript
// shared/util/zoom-toolkit/index.ts
export {default as ResumableZoom} from './ResumableZoom'
export {CropZoom} from './CropZoom'
export type {CropZoomRefType, CropContextResult} from './CropZoom'
export {fitContainer} from './fitContainer'
export {default as useImageResolution} from './useImageResolution'
export type {CommonZoomState, SizeVector, SwipeDirection} from './types'
```

- [ ] **Step 2: Commit**

```bash
cd shared && git add util/zoom-toolkit/index.ts
git commit -m "add zoom-toolkit index"
```

---

### Task 8: Update consumers

**Files:**
- Modify: `shared/common-adapters/zoomable-image.tsx`
- Modify: `shared/profile/edit-avatar/index.tsx`

- [ ] **Step 1: Update zoomable-image.tsx import**

In `shared/common-adapters/zoomable-image.tsx`, change line 8:

```typescript
// Before:
import {fitContainer, ResumableZoom, useImageResolution} from 'react-native-zoom-toolkit'

// After:
import {fitContainer, ResumableZoom, useImageResolution} from '@/util/zoom-toolkit'
```

- [ ] **Step 2: Update edit-avatar import**

In `shared/profile/edit-avatar/index.tsx`, change line 12:

```typescript
// Before:
import {CropZoom, type CropZoomRefType} from 'react-native-zoom-toolkit'

// After:
import {CropZoom, type CropZoomRefType} from '@/util/zoom-toolkit'
```

- [ ] **Step 3: Commit**

```bash
cd shared && git add common-adapters/zoomable-image.tsx profile/edit-avatar/index.tsx
git commit -m "update zoom-toolkit consumers to use local module"
```

---

### Task 9: Remove the npm dep and update config files

**Files:**
- Modify: `shared/package.json`
- Modify: `shared/jest.config.js`
- Modify: `shared/native-only-modules.js`
- Delete: `shared/patches/react-native-zoom-toolkit+5.0.1.patch`

- [ ] **Step 1: Remove from package.json**

In `shared/package.json`, remove the line:
```json
"react-native-zoom-toolkit": "5.0.1",
```

- [ ] **Step 2: Remove from jest.config.js transformIgnorePatterns**

In `shared/jest.config.js`, find the `transformIgnorePatterns` string containing `react-native-zoom-toolkit` and remove it. The pattern to remove is `|react-native-zoom-toolkit` (including the leading pipe).

Current line (line 53):
```
'node_modules/(?!(react-native|@react-native|@react-native-community|@react-navigation|expo(-[a-z-]+)?|lottie-react-native|react-native-safe-area-context|react-native-screens|react-native-webview|react-native-keyboard-controller|react-native-zoom-toolkit|react-native-kb|@gorhom|@callstack|@legendapp|sf-symbols-typescript)/)',
```

After removing `|react-native-zoom-toolkit`:
```
'node_modules/(?!(react-native|@react-native|@react-native-community|@react-navigation|expo(-[a-z-]+)?|lottie-react-native|react-native-safe-area-context|react-native-screens|react-native-webview|react-native-keyboard-controller|react-native-kb|@gorhom|@callstack|@legendapp|sf-symbols-typescript)/)',
```

- [ ] **Step 3: Remove from native-only-modules.js**

In `shared/native-only-modules.js`, remove the line:
```javascript
  'react-native-zoom-toolkit',
```

- [ ] **Step 4: Delete the patch file**

```bash
rm shared/patches/react-native-zoom-toolkit+5.0.1.patch
```

- [ ] **Step 5: Commit**

```bash
cd shared && git add package.json jest.config.js native-only-modules.js && git rm patches/react-native-zoom-toolkit+5.0.1.patch
git commit -m "remove react-native-zoom-toolkit dep and patch file"
```

---

### Task 10: Install deps and validate

**Files:** None (validation only)

- [ ] **Step 1: Run yarn to remove the dep from the lockfile**

```bash
cd shared && yarn
```

Expected: yarn removes `react-native-zoom-toolkit` from `node_modules` and updates the lockfile. No errors.

- [ ] **Step 2: Run lint**

```bash
cd shared && yarn lint
```

Expected: no errors related to our new files or changed imports.

- [ ] **Step 3: Run tsc**

```bash
cd shared && yarn tsc
```

Expected: no type errors. If there are type errors, they will likely be in one of:
- `CropZoom.tsx` — check that `CropZoomTransformState` matches the `resetTo` call shape
- `ResumableZoom.tsx` — check `useDerivedValue` type inference for `maxScale`
- Consumer files — check that the exported types satisfy the ref usage

Fix any errors before proceeding.

- [ ] **Step 4: Commit lockfile**

```bash
cd shared && git add yarn.lock
git commit -m "update yarn.lock after removing react-native-zoom-toolkit"
```
