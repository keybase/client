import * as React from 'react'
import AutosizeInput from './autosize-input.desktop'
import {action, storiesOf} from '../../stories/storybook'

const props = {
  onChange: action('onchnage'),
}
const load = () => {
  storiesOf('Search/AutosizeInput', module)
    .add('Normal', () => <AutosizeInput {...props} value={'here is some long text'} placeholder={''} />)
    .add('Placeholder', () => <AutosizeInput {...props} value={''} placeholder={'Type here...'} />)
    .add('Styled', () => (
      <AutosizeInput
        {...props}
        value={'styled inputs work too!'}
        placeholder={''}
        inputStyle={{
          backgroundColor: 'papayawhip',
          borderWidth: 2,
          fontSize: 20,
          padding: 10,
        }}
      />
    ))
}
export default load
