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
  value?: string | undefined
  onChangeText?: ((text: string) => void) | undefined
  placeholder?: string | undefined
  maxLength?: number | undefined

  // Chrome
  error?: boolean | undefined
  icon?: IconType | undefined
  prefix?: string | undefined
  decoration?: React.ReactNode | undefined
  hideBorder?: boolean | undefined
  disabled?: boolean | undefined
  containerStyle?: StylesCrossPlatform | undefined
  inputStyle?: StylesCrossPlatform | undefined

  // Text
  textType?: TextType | undefined

  // Behavior
  autoFocus?: boolean | undefined
  selectTextOnFocus?: boolean | undefined
  multiline?: boolean | undefined
  rowsMin?: number | undefined
  rowsMax?: number | undefined
  growAndScroll?: boolean | undefined
  secureTextEntry?: boolean | undefined

  // Keyboard
  onEnterKeyDown?: ((event?: React.KeyboardEvent) => void) | undefined
  onKeyDown?: ((event: React.KeyboardEvent) => void) | undefined
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send' | undefined
  keyboardType?: KeyboardType | undefined
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters' | undefined
  autoCorrect?: boolean | undefined
  spellCheck?: boolean | undefined

  // Focus
  onFocus?: (() => void) | undefined
  onBlur?: (() => void) | undefined
  onClick?: ((event: React.BaseSyntheticEvent) => void) | undefined

  // iOS autofill
  textContentType?: TextContentType | undefined
}

declare function Input3(props: Input3Props & {ref?: React.Ref<Input3Ref> | undefined}): React.ReactNode

export default Input3
