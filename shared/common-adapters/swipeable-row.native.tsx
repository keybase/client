import * as React from 'react'
import * as Reanimated from 'react-native-reanimated'
import {PanResponder, View, type GestureResponderEvent, type PanResponderGestureState, type ViewStyle} from 'react-native'

export type SwipeableMethods = {
  close: () => void
}

type Props = {
  children?: React.ReactNode
  renderRightActions?: (
    progress: Reanimated.SharedValue<number>,
    translation: Reanimated.SharedValue<number>
  ) => React.ReactNode
  onSwipeableOpenStartDrag?: () => void
  onSwipeableWillOpen?: (direction: 'left') => void
  containerStyle?: ViewStyle
}

const SwipeableRow = React.forwardRef<SwipeableMethods, Props>(function SwipeableRow(props, ref) {
  'use no memo'
  const {children, renderRightActions, onSwipeableOpenStartDrag, onSwipeableWillOpen, containerStyle} = props

  const translationX = Reanimated.useSharedValue(0)
  const openWidthSV = Reanimated.useSharedValue(0)

  const progress = Reanimated.useDerivedValue(() =>
    Reanimated.interpolate(
      -translationX.value,
      [0, openWidthSV.value > 0 ? openWidthSV.value : 1],
      [0, 1],
      Reanimated.Extrapolation.CLAMP
    )
  )

  const startTranslationRef = React.useRef(0)
  const wasClosedOnGrantRef = React.useRef(true)
  const hasFiredOpenStartDragRef = React.useRef(false)
  const cbRef = React.useRef({onSwipeableOpenStartDrag, onSwipeableWillOpen})

  const [ctx] = React.useState(() => {
    let _grant = () => {}
    let _move = (_dx: number, _vx: number) => {}
    let _release = (_dx: number, _vx: number) => {}
    let _close = () => {}
    return {
      panHandlers: PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e: GestureResponderEvent, gs: PanResponderGestureState) =>
          Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 5,
        onPanResponderGrant: () => _grant(),
        onPanResponderMove: (_e: GestureResponderEvent, gs: PanResponderGestureState) => _move(gs.dx, gs.vx),
        onPanResponderRelease: (_e: GestureResponderEvent, gs: PanResponderGestureState) => _release(gs.dx, gs.vx),
        onPanResponderTerminate: (_e: GestureResponderEvent, gs: PanResponderGestureState) =>
          _release(gs.dx, gs.vx),
      }).panHandlers,
      close: () => _close(),
      set(
        grant: () => void,
        move: (dx: number, vx: number) => void,
        release: (dx: number, vx: number) => void,
        close: () => void
      ) {
        _grant = grant
        _move = move
        _release = release
        _close = close
      },
    }
  })

  React.useImperativeHandle(ref, () => ({close: ctx.close}))

  React.useLayoutEffect(() => {
    cbRef.current = {onSwipeableOpenStartDrag, onSwipeableWillOpen}
    ctx.set(
      () => {
        startTranslationRef.current = translationX.value
        wasClosedOnGrantRef.current = translationX.value > -5
        hasFiredOpenStartDragRef.current = false
      },
      (dx, _vx) => {
        const newX = Math.min(0, startTranslationRef.current + dx)
        if (wasClosedOnGrantRef.current && !hasFiredOpenStartDragRef.current && newX < -5) {
          hasFiredOpenStartDragRef.current = true
          cbRef.current.onSwipeableOpenStartDrag?.()
        }
        translationX.set(newX)
      },
      (dx, vx) => {
        const newX = Math.min(0, startTranslationRef.current + dx)
        const width = openWidthSV.value
        const shouldOpen = width > 0 && (newX < -(width * 0.4) || vx < -0.5)
        if (shouldOpen) {
          translationX.set(Reanimated.withSpring(-width, {duration: 300}))
          cbRef.current.onSwipeableWillOpen?.('left')
        } else {
          translationX.set(Reanimated.withSpring(0, {duration: 300}))
        }
      },
      () => {
        translationX.set(Reanimated.withSpring(0, {duration: 300}))
      }
    )
  })

  const animStyle = Reanimated.useAnimatedStyle(() => ({
    transform: [{translateX: translationX.value}],
  }))

  return (
    <View style={[{overflow: 'hidden'}, containerStyle]}>
      {renderRightActions && (
        <View
          style={{bottom: 0, flexDirection: 'row-reverse', left: 0, overflow: 'hidden', position: 'absolute', right: 0, top: 0}}
        >
          <View
            style={{flexDirection: 'row'}}
            onLayout={e => {
              openWidthSV.set(e.nativeEvent.layout.width)
            }}
          >
            {renderRightActions(progress, translationX)}
          </View>
        </View>
      )}
      <Reanimated.default.View style={animStyle} {...ctx.panHandlers}>
        {children}
      </Reanimated.default.View>
    </View>
  )
})

export default SwipeableRow
