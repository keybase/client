import type {IconType} from '@/common-adapters/icon.constants-gen'
import type {TextType} from '@/common-adapters/text.shared'
import type * as React from 'react'
import type * as Styles from '@/styles'

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

export type Input3Ref = {
  focus: () => void
  blur: () => void
  clear: () => void
}

export type Input3Props = {
  value?: string
  onChangeText?: (text: string) => void
  placeholder?: string
  maxLength?: number
  error?: boolean
  icon?: IconType
  prefix?: string
  decoration?: React.ReactNode
  hideBorder?: boolean
  disabled?: boolean
  containerStyle?: Styles.StylesCrossPlatform
  inputStyle?: Styles.StylesCrossPlatform
  textType?: TextType
  autoFocus?: boolean
  selectTextOnFocus?: boolean
  multiline?: boolean
  rowsMin?: number
  rowsMax?: number
  growAndScroll?: boolean
  secureTextEntry?: boolean
  onEnterKeyDown?: (event?: React.KeyboardEvent) => void
  onKeyDown?: (event: React.KeyboardEvent) => void
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send'
  keyboardType?: KeyboardType
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoCorrect?: boolean
  spellCheck?: boolean
  onFocus?: () => void
  onBlur?: () => void
  onClick?: (event: React.BaseSyntheticEvent) => void
  textContentType?: TextContentType
}
