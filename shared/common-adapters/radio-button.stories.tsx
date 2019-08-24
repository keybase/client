import Box from './box'
import RadioButton from './radio-button'
import React from 'react'
import {storiesOf, action} from '../stories/storybook'

const Kb = {
  Box,
  RadioButton,
}

const commonProps = {
  disabled: false,
  onSelect: newSelectedValue => action(`Got selected: ${newSelectedValue ? 'true' : 'false'}`),
  style: {margin: 10},
}

const load = () => {
  storiesOf('Common', module).add('RadioButton', () => (
    <Kb.Box style={{flex: 1}}>
      <Kb.RadioButton {...commonProps} label="RadioButton Unselected Enabled" selected={false} />
      <Kb.RadioButton {...commonProps} label="RadioButton Selected Enabled" selected={true} />
      <Kb.RadioButton
        {...commonProps}
        label="RadioButton Unselected Disabled"
        selected={false}
        disabled={true}
      />
      <Kb.RadioButton
        {...commonProps}
        label="RadioButton Selected Disabled"
        selected={true}
        disabled={true}
      />
    </Kb.Box>
  ))
}

export default load
