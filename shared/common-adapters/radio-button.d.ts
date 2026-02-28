import type * as React from 'react'

export type Props = {
  label: string | React.ReactNode
  onSelect: (selected: boolean) => void
  selected: boolean
  style?: object
  disabled?: boolean
}

declare const RadioButton: (p: Props) => React.ReactNode
export default RadioButton
