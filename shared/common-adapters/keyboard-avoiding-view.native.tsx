import * as React from 'react'
import * as Styles from '../styles'
import {KeyboardAvoidingView} from 'react-native'
import Animated, {useAnimatedKeyboard, useAnimatedStyle} from 'react-native-reanimated'
import type {AnimatedProps} from './keyboard-avoiding-view'

export const AnimatedKeyboardAvoidingView = (p: AnimatedProps) => {
  const keyboard = useAnimatedKeyboard()
  const translateStyle = useAnimatedStyle(() => {
    return p.wrapStyle === 'translate'
      ? {transform: [{translateY: -keyboard.height.value}]}
      : {paddingBottom: keyboard.height.value}
  })

  return <Animated.View style={[styles.keyboard, translateStyle, p.style]}>{p.children}</Animated.View>
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      keyboard: {
        flexGrow: 1,
        position: 'relative',
      },
    } as const)
)

export default KeyboardAvoidingView
