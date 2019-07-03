import * as React from 'react'
import {Props as CheckboxProps} from './checkbox'
import {Props as InputProps} from './input'
import FormWithCheckbox from './form-with-checkbox'
import {action, storiesOf} from '../stories/storybook'

const commonCheckboxProps: CheckboxProps = {
  checked: false,
  onCheck: action('onCheck'),
}

const commonInputProps: InputProps = {
  onBlur: action('onBlur'),
  onChangeText: action('onChangeText'),
  onClick: action('onClick'),
  onEnterKeyDown: action('onEnterKeyDown'),
  onFocus: action('onFocus'),
  onKeyDown: action('onKeyDown'),
  onKeyUp: action('onKeyUp'),
}

const load = () => {
  storiesOf('Common/FormWithCheckbox', module)
    .add('Single', () => (
      <FormWithCheckbox
        checkboxesProps={[{...commonCheckboxProps, label: 'checkbox'}]}
        inputProps={commonInputProps}
      />
    ))
    .add('Multiple', () => (
      <FormWithCheckbox
        checkboxesProps={[
          {...commonCheckboxProps, label: 'checkbox 1'},
          {...commonCheckboxProps, label: 'checkbox 2'},
        ]}
        inputProps={commonInputProps}
      />
    ))
}

export default load
