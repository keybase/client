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
