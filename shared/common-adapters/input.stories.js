// @flow
import * as React from 'react'
import Input from './input'
import {action, storiesOf} from '../stories/storybook'

const load = () => {
  storiesOf('Common', module).add('Input (plain)', () => (
    <Input
      onBlur={action('onBlur')}
      onClick={action('onClick')}
      onChangeText={action('onChangeText')}
      onEnterKeyDown={action('onEnterKeyDown')}
      onFocus={action('onFocus')}
      onKeyDown={action('onKeyDown')}
      onKeyUp={action('onKeyUp')}
      onSelectionChange={action('onSelectionChange')}
    />
  ))
}

export default load
