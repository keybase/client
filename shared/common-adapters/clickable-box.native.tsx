import * as React from 'react'
import * as Styles from '../styles'
import Box from './box'
import {
  NativeTouchableOpacity,
  NativeTouchableWithoutFeedback,
  NativePressable,
} from './native-wrappers.native'
import type {Props, Props2} from './clickable-box'

const Kb = {
  Box,
  NativeTouchableOpacity,
  NativeTouchableWithoutFeedback,
}

const ClickableBox = React.forwardRef<NativeTouchableWithoutFeedback | NativeTouchableOpacity | Box, Props>(
  function ClickableBoxInner(props: Props, ref: any) {
    const {feedback = true, onClick, onPressIn, onPressOut, onLongPress} = props
    const {style, activeOpacity, children, pointerEvents} = props
    if (onClick) {
      const clickStyle = Styles.collapseStyles([styles.box, style])
      if (feedback) {
        return (
          <Kb.NativeTouchableOpacity
            // @ts-ignore
            ref={ref}
            // @ts-ignore
            pointerEvents={pointerEvents}
            disabled={!onClick}
            onPress={onClick}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            onLongPress={onLongPress}
            style={clickStyle}
            activeOpacity={activeOpacity ?? 0.7}
          >
            {children}
          </Kb.NativeTouchableOpacity>
        )
      } else {
        return (
          <Kb.NativeTouchableWithoutFeedback
            // @ts-ignore
            ref={ref}
            // @ts-ignore
            pointerEvents={pointerEvents}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            style={clickStyle}
            onPress={onClick}
            onLongPress={onLongPress}
          >
            {children}
          </Kb.NativeTouchableWithoutFeedback>
        )
      }
    } else {
      if (__DEV__) {
        if (onPressIn || onPressOut || onLongPress) {
          console.warn("Passed onPress*/on*Press with no onPress, which isn't supported on the native side")
        }
      }
      return (
        <Kb.Box style={style} pointerEvents={pointerEvents} ref={ref}>
          {children}
        </Kb.Box>
      )
    }
  }
)

const styles = Styles.styleSheetCreate(() => ({
  box: {borderRadius: 3},
}))

export default ClickableBox

export const ClickableBox2 = (p: Props2) => {
  const {onLongPress, onClick, children, style} = p
  return (
    <NativePressable onLongPress={onLongPress} onPress={onClick} style={style}>
      {children}
    </NativePressable>
  )
}
