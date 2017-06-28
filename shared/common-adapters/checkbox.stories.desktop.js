// @flow
/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
import Checkbox from './checkbox'
import React from 'react'
// import {action} from '@storybook/addon-actions'
// import {storiesOf} from '@storybook/react'

const commonProps = {
  disabled: false,
  onCheck: newCheckedValue => action(`Got check: ${newCheckedValue ? 'true' : 'false'}`),
  style: {margin: 10},
}

const load = () => {
  // storiesOf('Checkbox', module).add('Checkbox', () => (
  // <div style={{flex: 1, overflow: 'auto'}}>
  // <Checkbox {...commonProps} label="Checkbox Unchecked Enabled" checked={false} />
  // <Checkbox {...commonProps} label="Checkbox Checked Enabled" checked={true} />
  // <Checkbox {...commonProps} label="Checkbox Unchecked Disabled" checked={false} disabled={true} />
  // <Checkbox {...commonProps} label="Checkbox Checked Disabled" checked={true} />
  // </div>
  // ))
}

export default load
