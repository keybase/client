import * as Styles from '@/styles'
import {Pressable, View, TouchableOpacity, TouchableWithoutFeedback} from 'react-native'
import type {Props, Props2} from './clickable-box'
const Kb = {
  Styles,
}

const ClickableBox = (props: Props) => {
  const {feedback = true, onClick, onPressIn, onPressOut, onLongPress} = props
  const {style, activeOpacity, children} = props

  if (onClick) {
    const clickStyle = Kb.Styles.collapseStyles([styles.box, style])
    if (feedback) {
      return (
        <TouchableOpacity
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
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={onClick}
          onLongPress={onLongPress}
        >
          <View style={clickStyle}>{children}</View>
        </TouchableWithoutFeedback>
      )
    }
  } else {
    if (__DEV__) {
      if (onPressIn || onPressOut || onLongPress) {
        console.warn("Passed onPress*/on*Press with no onPress, which isn't supported on the native side")
      }
    }
    return <View style={style}>{children}</View>
  }
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  box: {borderRadius: 3},
}))

export default ClickableBox

export const ClickableBox2 = (p: Props2) => {
  const {onLongPress, onClick, children, hitSlop, style} = p
  const onPress = () => {
    onClick?.()
  }
  return (
    <Pressable onLongPress={onLongPress} onPress={onPress} style={style} hitSlop={hitSlop}>
      {children}
    </Pressable>
  )
}
