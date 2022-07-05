import * as React from 'react'
import Box from './box'
import {storiesOf} from '../stories/storybook'
import LabeledInput, {Props} from './labeled-input'

const ControledLabeledInput = (props: Props) => {
  const [value, setValue] = React.useState('')
  return <LabeledInput value={value} onChangeText={setValue} {...props} />
}

const load = () => {
  storiesOf('Common/Labeled input', module)
    .addDecorator(story => <Box style={{maxWidth: 400, padding: 10}}>{story()}</Box>)
    .add('Basic, controled', () => <ControledLabeledInput placeholder="Username" />)
    .add('Basic, uncontroled', () => <LabeledInput placeholder="Username" />)
    .add('Large text type', () => <LabeledInput placeholder="Large text" textType="Header" />)
    .add('Error state', () => <LabeledInput placeholder="Error" error={true} />)
    .add('Multiline large text with a placeholder', () => (
      <LabeledInput
        placeholder="Large text"
        textType="Header"
        multiline={true}
        rowsMax={4}
        hoverPlaceholder="Ex: hello world!"
      />
    ))
    .add('Multiline with a placeholder', () => (
      <LabeledInput
        placeholder="Large text"
        multiline={true}
        rowsMax={3}
        hoverPlaceholder="Ex: hello world!"
      />
    ))
}

export default load
