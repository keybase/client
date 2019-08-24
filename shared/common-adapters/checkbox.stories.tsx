import Box from './box'
import Checkbox from './checkbox'
import * as React from 'react'
import * as Sb from '../stories/storybook'

const commonProps = {
  disabled: false,
  onCheck: Sb.action('onCheck'),
  style: {margin: 10},
}

const load = () => {
  Sb.storiesOf('Common', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Checkbox', () => (
      <Box style={{flex: 1}}>
        <Checkbox {...commonProps} label="Checkbox Unchecked Enabled" checked={false} />
        <Checkbox {...commonProps} label="Checkbox Checked Enabled" checked={true} />
        <Checkbox {...commonProps} label="Checkbox Unchecked Disabled" checked={false} disabled={true} />
        <Checkbox {...commonProps} label="Checkbox Checked Disabled" checked={true} disabled={true} />
      </Box>
    ))
}

export default load
