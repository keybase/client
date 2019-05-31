import React, {Component} from 'react'

export type Props = {
  label: string
  onSelect: (selected: boolean) => void
  selected: boolean
  style?: Object
  disabled?: boolean
}

declare class RadioButton extends Component<Props> {}
export default RadioButton
