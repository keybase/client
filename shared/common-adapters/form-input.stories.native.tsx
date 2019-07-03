import * as React from 'react'
import {Box} from '../common-adapters'
import {storiesOf, action} from '../stories/storybook'
import {FormInput} from './form-input.native'
import {globalStyles} from '../styles'

const onChangeText = action('onChangeText')

const load = () => {
  storiesOf('Common/Form input', module)
    .add('Basic', () => {
      return <FormInput label="Label" onChangeText={onChangeText} />
    })
    .add('Blank label', () => {
      return <FormInput label="" onChangeText={onChangeText} />
    })
    .add('Pre-populated', () => {
      return <FormInput label="Label" value="Hello" onChangeText={onChangeText} />
    })
    .add('Secure', () => {
      return <FormInput label="Password" secure={true} onChangeText={onChangeText} />
    })
    .add('Multiple', () => (
      <Box style={globalStyles.flexBoxColumn}>
        <FormInput label="Label 1" hideBottomBorder={true} onChangeText={onChangeText} />
        <FormInput label="Label 2" hideBottomBorder={true} onChangeText={onChangeText} />
        <FormInput label="Label 3" onChangeText={onChangeText} />
      </Box>
    ))
    .add('Multiline', () => <FormInput label="Multiline!" multiline={true} onChangeText={onChangeText} />)
    .add('Mixed rows', () => (
      <Box style={globalStyles.flexBoxColumn}>
        <FormInput label="Label 1" hideBottomBorder={true} onChangeText={onChangeText} />
        <FormInput label="Label 2" hideBottomBorder={true} onChangeText={onChangeText} />
        <FormInput
          label="Multiline!"
          multiline={true}
          hideBottomBorder={true}
          maxHeight={200}
          onChangeText={onChangeText}
        />
        <FormInput label="Label 3" onChangeText={onChangeText} />
      </Box>
    ))
}

export default load
