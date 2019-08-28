import * as React from 'react'
import Box from './box'
import {storiesOf} from '../stories/storybook'
import LabeledInput, {Props} from './labeled-input'

const WrappedInput = (props: Props) => {
  const [value, setValue] = React.useState('')
  return <LabeledInput value={value} onChangeText={setValue} {...props} />
}

const load = () => {
  storiesOf('Common/Labeled input', module)
    .addDecorator(story => <Box style={{maxWidth: 400, padding: 10}}>{story()}</Box>)
    .add('Basic', () => <WrappedInput placeholder="Username" />)
    .add('Large text type', () => <WrappedInput placeholder="Large text" textType="HeaderExtrabold" />)
    .add('Error state', () => <WrappedInput placeholder="Error" error={true} />)
}

export default load
