import type * as React from 'react'

export type Props = {
  label: string | React.ReactNode
  onSelect: (selected: boolean) => void
  selected: boolean
  style?: object
  disabled?: boolean
}
