import * as React from 'react'
import {StylesCrossPlatform, globalMargins, CustomStyles} from '../styles'
import {TextType} from './text'

export type KeyboardType =
  | 'default'
  | 'email-address'
  | 'numeric'
  | 'phone-pad'
  // iOS only
  | 'ascii-capable'
  | 'numbers-and-punctuation'
  | 'url'
  | 'number-pad'
  | 'name-phone-pad'
  | 'decimal-pad'
  | 'twitter'
  | 'web-search'
  // Android Only
  | 'visible-password'

// All iOS only
export type TextContentType =
  | 'none'
  | 'URL'
  | 'addressCity'
  | 'addressCityAndState'
  | 'addressState'
  | 'countryName'
  | 'creditCardNumber'
  | 'emailAddress'
  | 'familyName'
  | 'fullStreetAddress'
  | 'givenName'
  | 'jobTitle'
  | 'location'
  | 'middleName'
  | 'name'
  | 'namePrefix'
  | 'nameSuffix'
  | 'nickname'
  | 'organizationName'
  | 'postalCode'
  | 'streetAddressLine1'
  | 'streetAddressLine2'
  | 'sublocality'
  | 'telephoneNumber'
  | 'username'
  | 'password'
  | 'newPassword'
  | 'oneTimeCode'

export type Selection = {
  start: number | null
  end: number | null
}

export type InputStyle = CustomStyles<'padding', {}>

export type Props = {
  autoFocus?: boolean
  // Enable if you want this to always have focus (desktop only)
  globalCaptureKeypress?: boolean
  className?: string
  disabled?: boolean
  // Resize in a flexbox-like fashion
  flexable?: boolean
  maxLength?: number
  // doesn't fire onChangeText if value would exceed maxBytes (utf-8)
  // i.e. can only have an effect if this is a controlled input
  // doesn't enforce on longer `props.value`s coming in
  maxBytes?: number
  multiline?: boolean
  // Allows multiline to grow to fill the parent and have scrollbars
  growAndScroll?: boolean
  onBlur?: () => void
  onChangeText?: (text: string) => void
  onFocus?: () => void
  padding?: keyof typeof globalMargins | 0 // globalMargins does not have an option for 0
  placeholder?: string
  placeholderColor?: string
  rowsMin?: number
  rowsMax?: number
  secureTextEntry?: boolean
  style?: InputStyle
  textType?: TextType
  type?: 'password' | 'text' | 'passwordVisible'
  value?: string // Makes this a controlled input when passed. Also disables mutating value via `transformText`, see note at component API,
  dummyInput?: boolean // Only affects mobile
  /* Platform discrepancies */
  // Maps to onSubmitEditing on native
  onEnterKeyDown?: (event?: React.BaseSyntheticEvent) => void
  // Desktop only
  onClick?: (event: Event) => void
  onKeyDown?: (event: React.KeyboardEvent, isComposingIME: boolean) => void
  onKeyUp?: (event: React.KeyboardEvent, isComposingIME: boolean) => void
  // Mobile only
  children?: React.ReactNode
  allowFontScaling?: boolean
  onKeyPress?: (event: {
    nativeEvent: {
      key: 'Enter' | 'Backspace' | string
    }
  }) => void
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoCorrect?: boolean
  keyboardType?: KeyboardType
  resize?: boolean
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send'
  selectTextOnFocus?: boolean
  onEndEditing?: () => void
  // very flakey, don't rely on this for up to date
  // selection; only works with multiline={true}
  onSelectionChange?: (selection: Selection) => void
  // iOS only - give some context as to what is supposed to go in this input
  // so the keyboard can give better recommendations. e.g.
  // newPassword - suggest strong password
  // oneTimeCode - suggest verification code arriving via SMS
  textContentType?: TextContentType
}

// Use this to mix your props with input props like type Props = PropsWithInput<{foo: number}>
export type PropsWithInput<P> = Props & P

/**
 * Flow does the work of making the default props nullable when instantiating
 * this component, but doesn't go as far as letting the props be
 * actually nullable in the type def. This complicates things when trying
 * to make this compatible with PropsWithInput. So here we split up the
 * internal type of Props from the public API, and 'lie' in this file
 * by claiming that this component takes `Props` when the implementations
 * use `InternalProps`.
 * See more discussion here: https://github.com/facebook/flow/issues/1660
 */
export type DefaultProps = {
  keyboardType: KeyboardType
  textType: TextType
}

export type TextInfo = {
  text: string
  selection: Selection
}

export type InternalProps = {} & DefaultProps & Props

declare class PlainInput extends React.Component<Props> {
  defaultProps: DefaultProps
  blur: () => void
  focus: () => void
  isFocused: () => boolean
  getSelection: () => Selection | null

  /**
   *  This can only be used when the input is controlled. Use `transformText` if
   *  you want to do this on an uncontrolled input. Make sure the Selection is
   *  valid against the `value` prop. Avoid changing `value` and calling this at
   *  the same time if you don't want bad things to happen. Note that a
   *  selection will only appear when the input is focused. Call `focus()`
   *  before this if you want to be sure the user will see the selection.
   **/
  setSelection: (selection: Selection) => void

  /**
   *  This can only be used when the input is uncontrolled. Like `setSelection`,
   *  if you want to be sure the user will see a selection use `focus()` before
   *  calling this.
   **/
  transformText: (fn: (textInfo: TextInfo) => TextInfo, reflectChange?: boolean) => void
}

export default PlainInput
