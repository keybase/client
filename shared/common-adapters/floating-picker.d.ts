import type * as React from 'react'

// Mobile only. Show native dropdown UI.

export type PickerItem<T> = {
  label: string
  value: T
}

export type Props<T> = {
  items: PickerItem<T>[] // values must be unique,,
  selectedValue?: T
  onSelect: (t: T | undefined) => void
  header?: React.ReactNode
  prompt?: React.ReactNode
  promptString?: string // used on android as title of selection popup,,
  onHidden: () => void
  onCancel: () => void
  onDone: () => void
  visible: boolean
}

declare function FloatingPicker<T>(p: Props<T>): React.ReactNode
export default FloatingPicker
