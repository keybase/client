import * as React from 'react'
import type * as Styles from '../styles'

export type AnimatedProps = {
  children: React.ReactNode
  wrapStyle?: 'padding' | 'translate'
  style?: Styles.StylesCrossPlatform
  // we try and compensate for enclosed safe areas
  ignoreSafe?: boolean
}

export type SimpleProps = {
  children: React.ReactNode
  style?: Styles.StylesCrossPlatform
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto' | undefined
}

// usually use this
export class SimpleKeyboardAvoidingView extends React.Component<SimpleProps> {}
// use this for nice animations
export class AnimatedKeyboardAvoidingView extends React.Component<AnimatedProps> {}
