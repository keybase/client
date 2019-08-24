import * as React from 'react'
import {StylesCrossPlatform} from '../styles'
import {TextType} from './text'
import {TextContentType} from './plain-input'

/**
 * DEPRECATED
 * Use plain-input or new-input instead
 */

export type KeyboardType =
  | 'default'
  | 'email-address'
  | 'numeric' // iOS only
  | 'phone-pad'
  | 'ascii-capable'
  | 'numbers-and-punctuation'
  | 'url'
  | 'number-pad'
  | 'name-phone-pad'
  | 'decimal-pad'
  | 'twitter' // Android Only
  | 'web-search'
  | 'visible-password'

export type Props = {
  // if true we use a smarter algorithm to decide when we need to recalculate our height
  // might be safe to use this everywhere but I wanted to limit it to just chat short term
  smartAutoresize?: boolean
  autoFocus?: boolean
  className?: string
  editable?: boolean
  errorStyle?: StylesCrossPlatform
  errorText?: string | null
  errorTextComponent?: React.ReactNode
  floatingHintTextOverride?: string | null // if undefined will use hintText. Use this to override hintText,
  hideUnderline?: boolean
  hintText?: string
  key?: string
  inputStyle?: StylesCrossPlatform
  multiline?: boolean
  onBlur?: () => void
  onClick?: (event: Event) => void
  onChangeText?: (text: string) => void
  onFocus?: () => void
  rowsMax?: number
  maxLength?: number
  rowsMin?: number
  hideLabel?: boolean
  ref?: React.Ref<Input>
  small?: boolean
  smallLabel?: string
  smallLabelStyle?: StylesCrossPlatform
  style?: StylesCrossPlatform
  type?: 'password' | 'text' | 'passwordVisible'
  value?: string | null
  selectTextOnFocus?: boolean
  // Incrememnt this to clear the text (avoids having to deal with refs)
  clearTextCounter?: number
  // Looks like desktop only, but used on mobile for onSubmitEditing (!).
  // TODO: Have a separate onSubmitEditing prop.
  onEnterKeyDown?: (e: React.BaseSyntheticEvent) => void
  // TODO this is a short term hack to have this be uncontrolled. I think likely by default we would want this to be uncontrolled but
  // i'm afraid of touching this now while I'm fixing a crash.
  // If true it won't use its internal value to drive its rendering
  uncontrolled?: boolean
  // Desktop only.
  onKeyDown?: (event: React.KeyboardEvent, isComposingIME: boolean) => void
  onKeyUp?: (event: React.KeyboardEvent, isComposingIME: boolean) => void
  // Mobile only
  onEndEditing?: () => void
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoCorrect?: boolean
  // If keyboardType is set, it overrides type.
  keyboardType?: KeyboardType
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send'
  // iOS only
  textContentType?: TextContentType
}

export type Selection = {
  start: number | null
  end: number | null
}

export type TextInfo = {
  text: string
  selection: Selection
}

declare class Input extends React.Component<Props> {
  blur: () => void
  focus: () => void
  select: () => void
  getValue: () => string
  selection: () => Selection
  // transformText must be called only on uncontrolled Input
  // components. The transformation may be done asynchronously.
  // @param reflectChange: desktop only. If true, `onChangeText`
  // will be called after the transform
  transformText: (fn: (TextInfo) => TextInfo, reflectChange?: boolean) => void
}
export default Input
