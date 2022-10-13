import * as React from 'react'
import {KeyboardAvoidingView} from 'react-native'
import Animated, {useAnimatedKeyboard, useAnimatedStyle} from 'react-native-reanimated'
import type {AnimatedProps} from './keyboard-avoiding-view'

export const AnimatedKeyboardAvoidingView = (p: AnimatedProps) => {
  const keyboard = useAnimatedKeyboard()
  const translateStyle = useAnimatedStyle(() => {
    return {
      transform: [{translateY: -keyboard.height.value}],
    }
  })

  return <Animated.View style={[translateStyle, p.style]}>{p.children}</Animated.View>
}

export default KeyboardAvoidingView
