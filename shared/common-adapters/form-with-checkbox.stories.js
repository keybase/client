// @flow
import * as React from 'react'
import {type Props as CheckboxProps} from './checkbox'
import {type Props as InputProps} from './input'
import FormWithCheckbox from './form-with-checkbox'
import {action, storiesOf} from '../stories/storybook'

const commonCheckboxProps: CheckboxProps = {
  checked: false,
  onCheck: action('onCheck'),
}

const commonInputProps: InputProps = {
  onBlur: action('onBlur'),
  onClick: action('onClick'),
  onChangeText: action('onChangeText'),
  onEnterKeyDown: action('onEnterKeyDown'),
  onFocus: action('onFocus'),
  onKeyDown: action('onKeyDown'),
  onKeyUp: action('onKeyUp'),
  onSelectionChange: action('onSelectionChange'),
}

const load = () => {
  storiesOf('Common', module)
    .add('Form w/ checkbox', () => (
      <FormWithCheckbox
        checkboxesProps={[{...commonCheckboxProps, label: 'checkbox'}]}
        inputProps={commonInputProps}
      />
    ))
    .add('Form w/ multiple checkboxes', () => (
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
