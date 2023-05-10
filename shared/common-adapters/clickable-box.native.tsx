import * as React from 'react'
import * as Styles from '../styles'
import Box from './box'
import {Pressable, TouchableOpacity, TouchableWithoutFeedback} from 'react-native'
import type {Props, Props2} from './clickable-box'

const Kb = {
  Box,
}

const ClickableBox = React.forwardRef<TouchableWithoutFeedback | TouchableOpacity | Box, Props>(
  function ClickableBoxInner(props: Props, ref: any) {
    const {feedback = true, onClick, onPressIn, onPressOut, onLongPress} = props
    const {style, activeOpacity, children, pointerEvents} = props
    if (onClick) {
      const clickStyle = Styles.collapseStyles([styles.box, style])
      if (feedback) {
        return (
          <TouchableOpacity
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
          </TouchableOpacity>
        )
      } else {
        return (
          <TouchableWithoutFeedback
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
          </TouchableWithoutFeedback>
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
    <Pressable onLongPress={onLongPress} onPress={onClick} style={style}>
      {children}
    </Pressable>
  )
}
