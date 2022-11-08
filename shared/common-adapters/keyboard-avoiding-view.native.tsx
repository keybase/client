import * as React from 'react'
import * as Styles from '../styles'
import {KeyboardAvoidingView} from 'react-native'
import Animated, {useAnimatedKeyboard, useAnimatedStyle} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import type {AnimatedProps, SimpleProps} from './keyboard-avoiding-view'

export const AnimatedKeyboardAvoidingView = Styles.isIOS
  ? (p: AnimatedProps) => {
      const keyboard = useAnimatedKeyboard()
      // we push up so the bottom insets have to be ignored now
      const insets = useSafeAreaInsets()
      let safeBottom = insets.bottom
      if (p.ignoreSafe) {
        safeBottom = 0
      }

      const translateStyle = useAnimatedStyle(() => {
        return p.wrapStyle === 'translate'
          ? {
              paddingBottom: Math.max(0, safeBottom - keyboard.height.value),
              transform: [{translateY: -keyboard.height.value}],
            }
          : {paddingBottom: Math.max(keyboard.height.value, safeBottom)}
      })

      return <Animated.View style={[styles.keyboard, translateStyle, p.style]}>{p.children}</Animated.View>
    }
  : (p: AnimatedProps) => {
      return (
        <KeyboardAvoidingView behavior={undefined} style={[styles.keyboard, p.style]}>
          {p.children}
        </KeyboardAvoidingView>
      )
    }

export const SimpleKeyboardAvoidingView = (p: SimpleProps) => {
  return (
    <KeyboardAvoidingView
      pointerEvents={p.pointerEvents}
      behavior={Styles.isIOS ? 'padding' : undefined}
      style={[styles.keyboard, p.style]}
    >
      {p.children}
    </KeyboardAvoidingView>
  )
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
