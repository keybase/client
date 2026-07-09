import * as React from 'react'
import * as Styles from '@/styles'
import {Animated, PanResponder, View, type GestureResponderEvent, type PanResponderGestureState, type ViewStyle} from 'react-native'
import type {Props, SwipeableMethods} from './swipeable-row.shared'
export type {SwipeableMethods} from './swipeable-row.shared'

const springConfig = {friction: 20, tension: 150, useNativeDriver: false} as const

const SwipeableRow = React.forwardRef<SwipeableMethods, Props>(function SwipeableRow(props, ref) {
  'use no memo'
  const {children, renderRightActions, onSwipeableOpenStartDrag, onSwipeableWillOpen, containerStyle} = props
  const {enabled = true} = props

  const translationX = React.useRef(new Animated.Value(0)).current
  // Separate ref for current value since Animated.Value has no sync .value read
  const translationXRef = React.useRef(0)
  // openWidthAnim drives progress; start at 1 to avoid divide-by-zero before onLayout
  const openWidthAnim = React.useRef(new Animated.Value(1)).current
  const openWidthRef = React.useRef(0)

  // progress = -translationX / openWidth, naturally 0→1 as row opens
  const progress = React.useRef(
    Animated.divide(Animated.multiply(translationX, -1), openWidthAnim) as Animated.AnimatedDivision<number>
  ).current

  const startTranslationRef = React.useRef(0)
  const wasClosedOnGrantRef = React.useRef(true)
  const hasFiredOpenStartDragRef = React.useRef(false)
  const cbRef = React.useRef({onSwipeableOpenStartDrag, onSwipeableWillOpen})

  const [ctx] = React.useState(() => {
    let _grant = () => {}
    let _move = (_dx: number, _vx: number) => {}
    let _release = (_dx: number, _vx: number) => {}
    let _close = () => {}
    let _reset = () => {}
    return {
      close: () => _close(),
      reset: () => _reset(),
      panHandlers: PanResponder.create({
        onMoveShouldSetPanResponder: (_e: GestureResponderEvent, gs: PanResponderGestureState) =>
          Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 5,
        onPanResponderGrant: () => _grant(),
        onPanResponderMove: (_e: GestureResponderEvent, gs: PanResponderGestureState) => _move(gs.dx, gs.vx),
        onPanResponderRelease: (_e: GestureResponderEvent, gs: PanResponderGestureState) =>
          _release(gs.dx, gs.vx),
        onPanResponderTerminate: (_e: GestureResponderEvent, gs: PanResponderGestureState) =>
          _release(gs.dx, gs.vx),
        onStartShouldSetPanResponder: () => false,
      }).panHandlers,
      set(
        grant: () => void,
        move: (dx: number, vx: number) => void,
        release: (dx: number, vx: number) => void,
        close: () => void,
        reset: () => void
      ) {
        _grant = grant
        _move = move
        _release = release
        _close = close
        _reset = reset
      },
    }
  })

  React.useImperativeHandle(ref, () => ({close: ctx.close, reset: ctx.reset}))

  React.useLayoutEffect(() => {
    cbRef.current = {onSwipeableOpenStartDrag, onSwipeableWillOpen}
    ctx.set(
      () => {
        startTranslationRef.current = translationXRef.current
        wasClosedOnGrantRef.current = translationXRef.current > -5
        hasFiredOpenStartDragRef.current = false
      },
      (dx, _vx) => {
        const newX = Math.min(0, startTranslationRef.current + dx)
        if (wasClosedOnGrantRef.current && !hasFiredOpenStartDragRef.current && newX < -5) {
          hasFiredOpenStartDragRef.current = true
          cbRef.current.onSwipeableOpenStartDrag?.()
        }
        translationXRef.current = newX
        translationX.setValue(newX)
      },
      (dx, vx) => {
        const newX = Math.min(0, startTranslationRef.current + dx)
        const width = openWidthRef.current
        // opening needs a deliberate drag; closing an open row only needs a small nudge right
        const shouldOpen = wasClosedOnGrantRef.current
          ? width > 0 && (newX < -(width * 0.4) || vx < -0.5)
          : width > 0 && newX < -(width * 0.85) && vx <= 0.1
        if (shouldOpen) {
          translationXRef.current = -width
          Animated.spring(translationX, {...springConfig, toValue: -width}).start()
          cbRef.current.onSwipeableWillOpen?.('left')
        } else {
          translationXRef.current = 0
          Animated.spring(translationX, {...springConfig, toValue: 0}).start()
        }
      },
      () => {
        translationXRef.current = 0
        Animated.spring(translationX, {...springConfig, toValue: 0}).start()
      },
      () => {
        translationX.stopAnimation()
        translationX.setValue(0)
        translationXRef.current = 0
      }
    )
  })

  const animStyle = React.useMemo(() => ({transform: [{translateX: translationX}]}), [translationX])

  return (
    <View style={[styles.outerOverflow as ViewStyle, containerStyle]}>
      {renderRightActions && (
        <View style={styles.actionsContainer as ViewStyle}>
          <View
            style={{flexDirection: 'row'}}
            onLayout={e => {
              const w = e.nativeEvent.layout.width
              openWidthRef.current = w
              openWidthAnim.setValue(w > 0 ? w : 1)
            }}
          >
            {renderRightActions(progress, translationX)}
          </View>
        </View>
      )}
      <Animated.View style={animStyle} {...(enabled ? ctx.panHandlers : undefined)}>
        {children}
      </Animated.View>
    </View>
  )
})

export default SwipeableRow

const styles = Styles.styleSheetCreate(() => ({
  actionsContainer: {
    ...Styles.globalStyles.fillAbsolute,
    flexDirection: 'row-reverse',
    overflow: 'hidden',
  },
  outerOverflow: {overflow: 'hidden'},
}))
