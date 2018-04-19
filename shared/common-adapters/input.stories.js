// @flow
import * as React from 'react'
import Input, {type Props} from './input'
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
  storiesOf('Common/Input', module)
    .add('Single line', () => <Input {...commonProps} />)
    .add('Multiline', () => <Input {...commonProps} multiline={true} />)
    .add('Password', () => <Input {...commonProps} type="password" />)
    .add('Visible password', () => <Input {...commonProps} type="passwordVisible" />)
}

export default load
