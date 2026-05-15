import type * as React from 'react'

export type Props<T extends string | number = string> = {
  header?: React.ReactNode
  items: Array<{label: string; value: T}>
  onCancel?: () => void
  onDone?: () => void
  onHidden: () => void
  onSelect: (v: T | undefined) => void
  prompt?: React.ReactNode
  promptString?: string
  selectedValue?: T
  visible: boolean
}

const FloatingPicker = <T extends string | number>(_props: Props<T>) => {
  throw new Error('FloatingPicker not supported on desktop')
}

export default FloatingPicker
