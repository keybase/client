// @flow
import Box from './box'
import Checkbox from './checkbox'
import React from 'react'
import {storiesOf, action} from '../stories/storybook'

const commonProps = {
  disabled: false,
  onCheck: newCheckedValue => action(`Got check: ${newCheckedValue ? 'true' : 'false'}`),
  style: {margin: 10},
}

const load = () => {
  storiesOf('Checkbox', module).add('Checkbox', () =>
    <Box style={{flex: 1}}>
      <Checkbox {...commonProps} label="Checkbox Unchecked Enabled" checked={false} />
      <Checkbox {...commonProps} label="Checkbox Checked Enabled" checked={true} />
      <Checkbox {...commonProps} label="Checkbox Unchecked Disabled" checked={false} disabled={true} />
      <Checkbox {...commonProps} label="Checkbox Checked Disabled" checked={true} />
    </Box>
  )
}

export default load
