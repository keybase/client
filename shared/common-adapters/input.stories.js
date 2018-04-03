// @flow
import * as React from 'react'
import {type Props, default as Input} from './input'
import {action, storiesOf} from '../stories/storybook'

const commonProps: Props = {
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
    .add('Input (single line)', () => <Input {...commonProps} />)
    .add('Input (multiline)', () => <Input {...commonProps} multiline={true} />)
    .add('Input (password)', () => <Input {...commonProps} type="password" />)
    .add('Input (visible password)', () => <Input {...commonProps} type="passwordVisible" />)
}

export default load
