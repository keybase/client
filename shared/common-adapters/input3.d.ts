import type * as React from 'react'
import type {IconType} from './icon'
import type {StylesCrossPlatform} from '@/styles'
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

declare function Input3(props: Input3Props & {ref?: React.Ref<Input3Ref>}): React.ReactNode

export default Input3
