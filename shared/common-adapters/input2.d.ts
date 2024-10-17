import type * as React from 'react'
import type * as Styles from '@/styles'
import type {TextType} from './text'

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
  onKeyDown?: (e: React.KeyboardEvent) => void
  onKeyUp?: (e: React.KeyboardEvent) => void
  onEnterKeyDown?: (e?: React.KeyboardEvent) => void
  placeholder?: string
  className?: string
  ref?: React.MutableRefObject<RefType | null>
  textType?: TextType
  style?: Styles.StylesCrossPlatform
  onChangeText?: (value: string) => void
  multiline?: boolean
  rowsMin?: number
  rowsMax?: number
  padding?: keyof typeof Styles.globalMargins | 0 // globalMargins does not have an option for 0
}

declare const Input2: React.ForwardRefExoticComponent<
  React.PropsWithoutRef<Props> & React.RefAttributes<RefType>
>
