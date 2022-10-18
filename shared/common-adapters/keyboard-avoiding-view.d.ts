import * as React from 'react'
export {KeyboardAvoidingView as default} from 'react-native'
import type * as Styles from '../styles'

export type AnimatedProps = {
  children: React.ReactNode
  wrapStyle?: 'padding' | 'translate'
  style?: Styles.StylesCrossPlatform
}

export class AnimatedKeyboardAvoidingView extends React.Component<AnimatedProps> {}
