import type * as React from 'react'
import * as Styles from '@/styles'
import {Pressable, View, TouchableOpacity, TouchableWithoutFeedback} from 'react-native'
import type {MeasureRef} from './measure-ref'

type Props = {
  className?: string
  children?: React.ReactNode
  style?: Styles.StylesCrossPlatform
  onClick?: (event: React.BaseSyntheticEvent) => void
  onDoubleClick?: (event: React.BaseSyntheticEvent) => void
  onPress?: never
  onLongPress?: (event: React.BaseSyntheticEvent) => void
  underlayColor?: string
  onPressIn?: () => void
  onPressOut?: () => void
  feedback?: boolean
  activeOpacity?: number
  hoverColor?: string
  onMouseOver?: (event: React.MouseEvent) => void
  onMouseEnter?: (event: React.MouseEvent) => void
  onMouseLeave?: (event: React.MouseEvent) => void
  onMouseDown?: (event: React.MouseEvent) => void
  onMouseMove?: (event: React.MouseEvent) => void
  onMouseUp?: (event: React.MouseEvent) => void
  title?: string
  tooltip?: string
}

type Props2 = {
  onLongPress?: () => void
  hitSlop?: number
  testID?: string
  onMouseOver?: (event: React.MouseEvent) => void
  onClick?: () => void
  children: React.ReactNode
  className?: string
  style?: Styles.StylesCrossPlatform
  ref?: React.Ref<MeasureRef>
}
const Kb = {
  Styles,
}

const ClickableBox = (props: Props & {ref?: React.Ref<MeasureRef>}) => {
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
  const {onLongPress, onClick, children, hitSlop, style, testID} = p
  const onPress = () => {
    onClick?.()
  }
  return (
    <Pressable onLongPress={onLongPress} onPress={onPress} style={style} hitSlop={hitSlop} testID={testID}>
      {children}
    </Pressable>
  )
}
