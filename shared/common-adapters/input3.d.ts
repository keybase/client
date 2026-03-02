import type * as React from 'react'
import type {IconType} from './icon'
import type {StylesCrossPlatform} from '@/styles'
import type {KeyboardType, TextContentType} from './plain-input'
import type {TextType} from './text.shared'

export type Input3Ref = {
  focus: () => void
  blur: () => void
  clear: () => void
}

export type Input3Props = {
  // Value
  value?: string
  onChangeText?: (text: string) => void
  placeholder?: string
  maxLength?: number

  // Chrome
  error?: boolean
  icon?: IconType
  prefix?: string
  decoration?: React.ReactNode
  hideBorder?: boolean
  disabled?: boolean
  containerStyle?: StylesCrossPlatform
  inputStyle?: StylesCrossPlatform

  // Text
  textType?: TextType

  // Behavior
  autoFocus?: boolean
  selectTextOnFocus?: boolean
  multiline?: boolean
  rowsMin?: number
  rowsMax?: number
  growAndScroll?: boolean
  secureTextEntry?: boolean

  // Keyboard
  onEnterKeyDown?: (event?: React.KeyboardEvent) => void
  onKeyDown?: (event: React.KeyboardEvent) => void
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send'
  keyboardType?: KeyboardType
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoCorrect?: boolean
  spellCheck?: boolean

  // Focus
  onFocus?: () => void
  onBlur?: () => void
  onClick?: (event: React.BaseSyntheticEvent) => void

  // iOS autofill
  textContentType?: TextContentType
}

declare const Input3: React.ForwardRefExoticType<Input3Props & React.RefAttributes<Input3Ref>>

export default Input3
