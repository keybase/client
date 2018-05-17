// @flow
import * as React from 'react'
import PlainInput from './plain-input'
import Box, {Box2} from './box'
import Text from './text'
import {action, storiesOf} from '../stories/storybook'
import {globalColors} from '../styles'

const commonProps = {
  onBlur: action('onBlur'),
  onChangeText: action('onChangeText'),
  onClick: action('onClick'),
  onEnterKeyDown: action('onEnterKeyDown'),
  onFocus: action('onFocus'),
  onKeyDown: action('onKeyDown'),
  onKeyUp: action('onKeyUp'),
  style: {borderWidth: 1, borderStyle: 'solid', borderColor: globalColors.black_10},
}

const load = () => {
  storiesOf('Common/Plain input', module)
    .addDecorator(story => <Box style={{padding: 20}}>{story()}</Box>)
    .add('Basic', () => <PlainInput {...commonProps} />)
    .add('Different text type', () => <PlainInput {...commonProps} textType="BodyExtrabold" />)
    .add('Larger text type', () => <PlainInput {...commonProps} textType="HeaderBig" />)
    .add('Number', () => <PlainInput {...commonProps} type="number" />)
    .add('Password', () => <PlainInput {...commonProps} type="password" />)
    .add('Multiline', () => <PlainInput {...commonProps} multiline={true} />)
    .add('Multiline with row constraints', () => (
      <PlainInput {...commonProps} multiline={true} rowsMin={4} rowsMax={8} />
    ))
    .add('Flexable', () => (
      <Box2 direction="vertical" fullWidth={true} gap="medium">
        <Box2
          direction="horizontal"
          fullWidth={true}
          gap="small"
          style={{padding: 10, backgroundColor: globalColors.orange}}
        >
          <PlainInput {...commonProps} flexable={true} />
          <Box style={{width: 200, backgroundColor: globalColors.green}} />
        </Box2>
        <Text type="Body">Resize your window to see the text input flex</Text>
      </Box2>
    ))
}

export default load
