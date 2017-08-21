// @flow
import Box from './box'
import RadioButton from './radio-button'
import React from 'react'
import {storiesOf, action} from '../stories/storybook'

const commonProps = {
  disabled: false,
  onCheck: newCheckedValue => action(`Got check: ${newCheckedValue ? 'true' : 'false'}`),
  style: {margin: 10},
}

const load = () => {
  storiesOf('Common', module).add('RadioButton', () => (
    <Box style={{flex: 1}}>
      <RadioButton {...commonProps} label="Checkbox Unchecked Enabled" selected={false} />
      <RadioButton {...commonProps} label="Checkbox Checked Enabled" selected={true} />
      <RadioButton {...commonProps} label="Checkbox Unchecked Disabled" selected={false} disabled={true} />
      <RadioButton {...commonProps} label="Checkbox Checked Disabled" selected={true} disabled={true} />
    </Box>
  ))
}

export default load
