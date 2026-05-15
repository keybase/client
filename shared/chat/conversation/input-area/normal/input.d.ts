import type * as React from 'react'
import type * as T from '@/constants/types'
import type * as Styles from '@/styles'
import type {TextType} from '@/common-adapters/text.shared'
import type {TextInputProps} from 'react-native'

export type RefType = {
  blur: () => void
  clear: () => void
  focus: () => void
  getSelection: () => Selection | undefined
  isFocused: () => boolean
  transformText: (fn: (textInfo: TextInfo) => TextInfo, reflectChange: boolean) => void
  value: string
  getBoundingClientRect?: () =>
    | undefined
    | {
        x: number
        y: number
        width: number
        height: number
        left: number
        top: number
        right: number
        bottom: number
      }
}

export type Selection = {
  start: number
  end?: number
}
export type TextInfo = {
  text: string
  selection?: Selection
}
export type Props = {
  allowKeyboardEvents?: boolean
  disabled?: boolean
  autoFocus?: boolean
  autoCorrect?: boolean
  onBlur?: TextInputProps['onBlur']
  onFocus?: TextInputProps['onFocus']
  onSelectionChange?: TextInputProps['onSelectionChange']
  autoCapitalize?: TextInputProps['autoCapitalize']
  onKeyDown?: (e: React.KeyboardEvent) => void
  onKeyUp?: (e: React.KeyboardEvent) => void
  onEnterKeyDown?: (e?: React.KeyboardEvent) => void
  placeholder?: string
  className?: string
  ref?: React.Ref<RefType | null>
  textType?: TextType
  style?: Styles.StylesCrossPlatform
  onChangeText?: (value: string) => void
  onPasteImage?: (uris: Array<string>) => void // mobile only
  multiline?: boolean
  rowsMin?: number
  rowsMax?: number
  padding?: keyof typeof Styles.globalMargins | 0 // globalMargins does not have an option for 0
}

export type PlatformInputProps = {
  cannotWrite: boolean
  explodingModeSeconds: number
  setExplodingMode: (mode: number) => void
  hintText: string
  setInputRef: (r: RefType | null) => void
  isEditing: boolean
  isExploding: boolean
  minWriterRole: T.Teams.TeamRoleType
  onCancelEditing: () => void
  onChangeText: (newText: string) => void
  onSubmit: (text: string) => void
  showReplyPreview: boolean
  suggestionOverlayStyle: Styles.StylesCrossPlatform
}

declare const PlatformInput: (p: PlatformInputProps) => React.ReactNode
export default PlatformInput
