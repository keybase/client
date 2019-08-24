// Project: https://github.com/kmagiera/react-native-gesture-handler
// TypeScript Version: 2.6.2

declare module 'react-native-gesture-handler' {
  import * as React from 'react'
  import {
    Animated,
    FlatListProperties,
    ScrollViewProperties,
    SliderProperties,
    SwitchProperties,
    TextInputProperties,
    ToolbarAndroidProperties,
    ViewPagerAndroidProperties,
    DrawerLayoutAndroidProperties,
    TouchableHighlightProperties,
    TouchableOpacityProperties,
    TouchableNativeFeedbackProperties,
    TouchableWithoutFeedbackProperties,
    Insets,
    ViewStyle,
    StyleProp,
  } from 'react-native'

  /* GESTURE HANDLER STATE */

  export enum Directions {
    RIGHT = 1,
    LEFT = 2,
    UP = 4,
    DOWN = 8,
  }

  export enum State {
    UNDETERMINED = 0,
    FAILED,
    BEGAN,
    CANCELLED,
    ACTIVE,
    END,
  }

  /* STATE CHANGE EVENTS */

  export interface GestureHandlerGestureEventNativeEvent {
    handlerTag: number
    numberOfPointers: number
    state: State
  }

  export interface GestureHandlerStateChangeNativeEvent {
    handlerTag: number
    numberOfPointers: number
    state: State
    oldState: State
  }

  export interface GestureHandlerStateChangeEvent {
    nativeEvent: GestureHandlerStateChangeNativeEvent
  }

  export interface GestureHandlerGestureEvent {
    nativeEvent: GestureHandlerGestureEventNativeEvent
  }

  interface NativeViewGestureHandlerEventExtra {
    pointerInside: boolean
  }

  export interface NativeViewGestureHandlerStateChangeEvent extends GestureHandlerStateChangeEvent {
    nativeEvent: GestureHandlerStateChangeNativeEvent & NativeViewGestureHandlerEventExtra
  }

  export interface NativeViewGestureHandlerGestureEvent extends GestureHandlerGestureEvent {
    nativeEvent: GestureHandlerGestureEventNativeEvent & NativeViewGestureHandlerEventExtra
  }

  interface TapGestureHandlerEventExtra {
    x: number
    y: number
    absoluteX: number
    absoluteY: number
  }

  interface ForceTouchGestureHandlerEventExtra {
    x: number
    y: number
    absoluteX: number
    absoluteY: number
    force: number
  }

  export interface TapGestureHandlerStateChangeEvent extends GestureHandlerStateChangeEvent {
    nativeEvent: GestureHandlerStateChangeNativeEvent & TapGestureHandlerEventExtra
  }

  export interface TapGestureHandlerGestureEvent extends GestureHandlerGestureEvent {
    nativeEvent: GestureHandlerGestureEventNativeEvent & TapGestureHandlerEventExtra
  }

  export interface ForceTouchGestureHandlerGestureEvent extends GestureHandlerGestureEvent {
    nativeEvent: GestureHandlerGestureEventNativeEvent & ForceTouchGestureHandlerEventExtra
  }

  export interface LongPressGestureHandlerStateChangeEvent extends GestureHandlerStateChangeEvent {
    nativeEvent: GestureHandlerStateChangeNativeEvent & LongPressGestureHandlerEventExtra
  }

  export interface ForceTouchGestureHandlerStateChangeEvent extends GestureHandlerStateChangeEvent {
    nativeEvent: GestureHandlerStateChangeNativeEvent & ForceTouchGestureHandlerEventExtra
  }

  interface LongPressGestureHandlerEventExtra {
    x: number
    y: number
    absoluteX: number
    absoluteY: number
  }

  interface PanGestureHandlerEventExtra {
    x: number
    y: number
    absoluteX: number
    absoluteY: number
    translationX: number
    translationY: number
    velocityX: number
    velocityY: number
  }

  export interface PanGestureHandlerStateChangeEvent extends GestureHandlerStateChangeEvent {
    nativeEvent: GestureHandlerStateChangeNativeEvent & PanGestureHandlerEventExtra
  }

  export interface PanGestureHandlerGestureEvent extends GestureHandlerGestureEvent {
    nativeEvent: GestureHandlerGestureEventNativeEvent & PanGestureHandlerEventExtra
  }

  interface PinchGestureHandlerEventExtra {
    scale: number
    focalX: number
    focalY: number
    velocity: number
  }

  export interface PinchGestureHandlerStateChangeEvent extends GestureHandlerStateChangeEvent {
    nativeEvent: GestureHandlerStateChangeNativeEvent & PinchGestureHandlerEventExtra
  }

  export interface PinchGestureHandlerGestureEvent extends GestureHandlerGestureEvent {
    nativeEvent: GestureHandlerGestureEventNativeEvent & PinchGestureHandlerEventExtra
  }

  interface RotationGestureHandlerEventExtra {
    rotation: number
    anchorX: number
    anchorY: number
    velocity: number
  }

  export interface RotationGestureHandlerStateChangeEvent extends GestureHandlerStateChangeEvent {
    nativeEvent: GestureHandlerStateChangeNativeEvent & RotationGestureHandlerEventExtra
  }

  export interface RotationGestureHandlerGestureEvent extends GestureHandlerGestureEvent {
    nativeEvent: GestureHandlerGestureEventNativeEvent & RotationGestureHandlerEventExtra
  }

  export interface FlingGestureHandlerStateChangeEvent extends GestureHandlerStateChangeEvent {
    nativeEvent: GestureHandlerStateChangeNativeEvent & FlingGestureHandlerEventExtra
  }

  export interface FlingGestureHandlerGestureEvent extends GestureHandlerGestureEvent {
    nativeEvent: GestureHandlerGestureEventNativeEvent
  }

  interface FlingGestureHandlerEventExtra {
    x: number
    y: number
    absoluteX: number
    absoluteY: number
  }

  /* GESTURE HANDLERS PROPERTIES */

  export interface GestureHandlerProperties {
    id?: string
    enabled?: boolean
    waitFor?: React.Ref<any> | React.Ref<any>[]
    simultaneousHandlers?: React.Ref<any> | React.Ref<any>[]
    shouldCancelWhenOutside?: boolean
    hitSlop?:
      | number
      | {
          left?: number
          right?: number
          top?: number
          bottom?: number
          vertical?: number
          horizontal?: number
        }
  }

  export interface NativeViewGestureHandlerProperties extends GestureHandlerProperties {
    shouldActivateOnStart?: boolean
    disallowInterruption?: boolean
    onGestureEvent?: (event: NativeViewGestureHandlerGestureEvent) => void
    onHandlerStateChange?: (event: NativeViewGestureHandlerStateChangeEvent) => void
  }

  export interface TapGestureHandlerProperties extends GestureHandlerProperties {
    minPointers?: number
    maxDurationMs?: number
    maxDelayMs?: number
    numberOfTaps?: number
    maxDeltaX?: number
    maxDeltaY?: number
    maxDist?: number
    onGestureEvent?: (event: TapGestureHandlerGestureEvent) => void
    onHandlerStateChange?: (event: TapGestureHandlerStateChangeEvent) => void
  }

  export interface ForceTouchGestureHandlerProperties extends GestureHandlerProperties {
    minForce?: number
    maxForce?: number
    feedbackOnActivation?: boolean
    onGestureEvent?: (event: ForceTouchGestureHandlerGestureEvent) => void
    onHandlerStateChange?: (event: ForceTouchGestureHandlerStateChangeEvent) => void
  }

  export interface LongPressGestureHandlerProperties extends GestureHandlerProperties {
    minDurationMs?: number
    maxDist?: number
    onGestureEvent?: (event: GestureHandlerGestureEvent) => void
    onHandlerStateChange?: (event: LongPressGestureHandlerStateChangeEvent) => void
  }

  export interface PanGestureHandlerProperties extends GestureHandlerProperties {
    /** @deprecated  use activeOffsetX*/
    minDeltaX?: number
    /** @deprecated  use activeOffsetY*/
    minDeltaY?: number
    /** @deprecated  use failOffsetX*/
    maxDeltaX?: number
    /** @deprecated  use failOffsetY*/
    maxDeltaY?: number
    /** @deprecated  use activeOffsetX*/
    minOffsetX?: number
    /** @deprecated  use failOffsetY*/
    minOffsetY?: number
    activeOffsetY?: number | number[]
    activeOffsetX?: number | number[]
    failOffsetY?: number | number[]
    failOffsetX?: number | number[]
    minDist?: number
    minVelocity?: number
    minVelocityX?: number
    minVelocityY?: number
    minPointers?: number
    maxPointers?: number
    avgTouches?: boolean
    onGestureEvent?: (event: PanGestureHandlerGestureEvent) => void
    onHandlerStateChange?: (event: PanGestureHandlerStateChangeEvent) => void
  }

  export interface PinchGestureHandlerProperties extends GestureHandlerProperties {
    onGestureEvent?: (event: PinchGestureHandlerGestureEvent) => void
    onHandlerStateChange?: (event: PinchGestureHandlerStateChangeEvent) => void
  }

  export interface RotationGestureHandlerProperties extends GestureHandlerProperties {
    onGestureEvent?: (event: RotationGestureHandlerGestureEvent) => void
    onHandlerStateChange?: (event: RotationGestureHandlerStateChangeEvent) => void
  }

  export interface FlingGestureHandlerProperties extends GestureHandlerProperties {
    direction?: number
    numberOfPointers?: number
    onGestureEvent?: (event: FlingGestureHandlerGestureEvent) => void
    onHandlerStateChange?: (event: FlingGestureHandlerStateChangeEvent) => void
  }

  /* GESTURE HANDLERS CLASSES */

  export class NativeViewGestureHandler extends React.Component<NativeViewGestureHandlerProperties> {}

  export class TapGestureHandler extends React.Component<TapGestureHandlerProperties> {}

  export class LongPressGestureHandler extends React.Component<LongPressGestureHandlerProperties> {}

  export class PanGestureHandler extends React.Component<PanGestureHandlerProperties> {}

  export class PinchGestureHandler extends React.Component<PinchGestureHandlerProperties> {}

  export class RotationGestureHandler extends React.Component<RotationGestureHandlerProperties> {}

  export class FlingGestureHandler extends React.Component<FlingGestureHandlerProperties> {}

  export class ForceTouchGestureHandler extends React.Component<ForceTouchGestureHandlerProperties> {}

  /* BUTTONS PROPERTIES */

  export interface RawButtonProperties extends NativeViewGestureHandlerProperties {
    exclusive?: boolean
    testID?: string
  }

  export interface BaseButtonProperties extends RawButtonProperties {
    onPress?: (pointerInside: boolean) => void
    onActiveStateChange?: (active: boolean) => void
    style?: StyleProp<ViewStyle>
  }

  export interface RectButtonProperties extends BaseButtonProperties {
    underlayColor?: string
    activeOpacity?: number
  }

  export interface BorderlessButtonProperties extends BaseButtonProperties {
    borderless?: boolean
  }

  /* BUTTONS CLASSES */

  export class RawButton extends React.Component<RawButtonProperties> {}

  export class BaseButton extends React.Component<BaseButtonProperties> {}

  export class RectButton extends React.Component<RectButtonProperties> {}

  export class BorderlessButton extends React.Component<BorderlessButtonProperties> {}

  export class TouchableHighlight extends React.Component<TouchableHighlightProperties> {}

  export class TouchableNativeFeedback extends React.Component<TouchableNativeFeedbackProperties> {}

  export class TouchableOpacity extends React.Component<TouchableOpacityProperties> {}

  export class TouchableWithoutFeedback extends React.Component<TouchableWithoutFeedbackProperties> {}

  /* GESTURE HANDLER WRAPPED CLASSES */

  export class ScrollView extends React.Component<
    NativeViewGestureHandlerProperties & ScrollViewProperties
  > {}

  export class Slider extends React.Component<NativeViewGestureHandlerProperties & SliderProperties> {}

  export class Switch extends React.Component<NativeViewGestureHandlerProperties & SwitchProperties> {}

  export class TextInput extends React.Component<NativeViewGestureHandlerProperties & TextInputProperties> {}

  export class ToolbarAndroid extends React.Component<
    NativeViewGestureHandlerProperties & ToolbarAndroidProperties
  > {}

  export class ViewPagerAndroid extends React.Component<
    NativeViewGestureHandlerProperties & ViewPagerAndroidProperties
  > {}

  export class DrawerLayoutAndroid extends React.Component<
    NativeViewGestureHandlerProperties & DrawerLayoutAndroidProperties
  > {}

  /* OTHER */

  export class FlatList extends React.Component<
    NativeViewGestureHandlerProperties & FlatListProperties<any>
  > {}

  export function gestureHandlerRootHOC(
    Component: React.ComponentType<any>,
    containerStyles?: StyleProp<ViewStyle>
  ): React.ComponentType<any>
}

declare module 'react-native-gesture-handler/Swipeable' {
  import {Animated} from 'react-native'

  interface SwipeableProperties {
    friction?: number
    leftThreshold?: number
    rightThreshold?: number
    overshootLeft?: boolean
    overshootRight?: boolean
    overshootFriction?: number
    onSwipeableLeftOpen?: () => void
    onSwipeableRightOpen?: () => void
    onSwipeableOpen?: () => void
    onSwipeableClose?: () => void
    onSwipeableLeftWillOpen?: () => void
    onSwipeableRightWillOpen?: () => void
    onSwipeableWillOpen?: () => void
    onSwipeableWillClose?: () => void
    renderLeftActions?: (
      progressAnimatedValue: Animated.Value,
      dragAnimatedValue: Animated.Value
    ) => React.ReactNode
    renderRightActions?: (
      progressAnimatedValue: Animated.Value,
      dragAnimatedValue: Animated.Value
    ) => React.ReactNode
    useNativeAnimations?: boolean
  }

  export default class Swipeable extends React.Component<SwipeableProperties> {
    close: () => void
    openLeft: () => void
    openRight: () => void
  }
}

declare module 'react-native-gesture-handler/DrawerLayout' {
  import {Animated, StatusBarAnimation} from 'react-native'

  interface DrawerLayoutProperties {
    renderNavigationView: (progressAnimatedValue: Animated.Value) => React.ReactNode
    drawerPosition?: 'left' | 'right'
    drawerWidth?: number
    drawerBackgroundColor?: string
    keyboardDismissMode?: 'none' | 'on-drag'
    onDrawerClose?: () => void
    onDrawerOpen?: () => void
    onDrawerStateChanged?: (newState: 'Idle' | 'Dragging' | 'Settling', drawerWillShow: boolean) => void
    useNativeAnimations?: boolean

    drawerType?: 'front' | 'back' | 'slide'
    edgeWidth?: number
    minSwipeDistance?: number
    hideStatusBar?: boolean
    statusBarAnimation?: StatusBarAnimation
    overlayColor?: string
    containerStyle?: any // StyleProp<ViewStyle>
  }

  interface DrawerMovementOptionType {
    velocity?: number
  }

  export default class DrawerLayout extends React.Component<DrawerLayoutProperties> {
    openDrawer: (options?: DrawerMovementOptionType) => void
    closeDrawer: (options?: DrawerMovementOptionType) => void
  }
}
