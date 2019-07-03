import Box from './box'
import RadioButton from './radio-button'
import React from 'react'
import {storiesOf, action} from '../stories/storybook'

const commonProps = {
  disabled: false,
  onSelect: newSelectedValue => action(`Got selected: ${newSelectedValue ? 'true' : 'false'}`),
  style: {margin: 10},
}

const load = () => {
  storiesOf('Common', module).add('RadioButton', () => (
    <Box style={{flex: 1}}>
      <RadioButton {...commonProps} label="RadioButton Unselected Enabled" selected={false} />
      <RadioButton {...commonProps} label="RadioButton Selected Enabled" selected={true} />
      <RadioButton
        {...commonProps}
        label="RadioButton Unselected Disabled"
        selected={false}
        disabled={true}
      />
      <RadioButton {...commonProps} label="RadioButton Selected Disabled" selected={true} disabled={true} />
    </Box>
  ))
}

export default load
