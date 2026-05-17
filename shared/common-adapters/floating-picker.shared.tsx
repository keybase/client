import type * as React from 'react'

export type PickerItem<T> = {
  label: string
  value: T
}

export type Props<T> = {
  items: PickerItem<T>[]
  selectedValue?: T
  onSelect: (t: T | undefined) => void
  header?: React.ReactNode
  prompt?: React.ReactNode
  promptString?: string
  onHidden: () => void
  onCancel: () => void
  onDone: () => void
  visible: boolean
}
