import * as React from 'react'
import * as Styles from '../styles'
import Box from './box'
import {View, Pressable, TouchableOpacity, TouchableWithoutFeedback} from 'react-native'
import type {Props, Props2} from './clickable-box'
import type {MeasureRef} from './measure-ref'

const Kb = {
  Box,
  Styles,
}

const ClickableBox = React.forwardRef<MeasureRef, Props>(function ClickableBoxInner(props: Props, ref: any) {
  const {feedback = true, onClick, onPressIn, onPressOut, onLongPress} = props
  const {style, activeOpacity, children, pointerEvents} = props

  React.useImperativeHandle(ref, () => {
    // we don't use this in mobile for now, and likely never
    return {}
  })

  if (onClick) {
    const clickStyle = Kb.Styles.collapseStyles([styles.box, style])
    if (feedback) {
      return (
        <TouchableOpacity
          // @ts-ignore maybe wrong
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
          // @ts-ignore maybe wrong
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
      <View style={style} pointerEvents={pointerEvents} ref={ref}>
        {children}
      </View>
    )
  }
})

const styles = Kb.Styles.styleSheetCreate(() => ({
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
