import * as React from 'react'

export type Props = {
  label: string | React.ReactNode
  onSelect: (selected: boolean) => void
  selected: boolean
  style?: Object
  disabled?: boolean
}

declare class RadioButton extends React.Component<Props> {}
export default RadioButton
