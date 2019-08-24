import React, {Component} from 'react'
import {StylesCrossPlatform} from '../styles'
import {Props as CheckboxProps} from './checkbox'
import {Props as InputProps} from './input'

// TODO: Do we really need this as a common component? It's used in
// only three places.

export type Props = {
  inputProps: InputProps
  style?: StylesCrossPlatform
  checkboxContainerStyle?: StylesCrossPlatform
  checkboxesProps: Array<CheckboxProps>
}

declare class FormWithCheckbox extends Component<Props> {}
export default FormWithCheckbox
