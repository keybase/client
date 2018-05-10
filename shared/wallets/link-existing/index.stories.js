// @flow
import * as React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import {Box} from '../../common-adapters'
import LinkExisting from '.'

const actions = {
  onCancel: action('onCancel'),
  onDone: action('onDone'),
  onNameChange: action('onNameChange'),
  onKeyChange: action('onKeyChange'),
  onViewChange: action('onViewChange'),
}

const enterKeyProps = {
  ...actions,
  name: '',
  secretKey: '',
  view: 'enter-key',
}

const load = () => {
  storiesOf('Wallets/Link existing', module)
    .addDecorator(story => <Box style={{maxWidth: 360}}>{story()}</Box>)
    .add('Paste key', () => <LinkExisting {...enterKeyProps} />)
}

export default load
