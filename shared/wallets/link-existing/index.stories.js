// @flow
import * as React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import {Box} from '../../common-adapters'
import {platformStyles} from '../../styles'
import LinkExisting from '.'

const common = {
  keyError: '',
  linkExistingAccountError: '',
  name: '',
  nameError: '',
  nameValidationState: 'none',
  onCancel: action('onCancel'),
  onCheckKey: action('onCheckKey'),
  onCheckName: action('onCheckName'),
  onClearErrors: action('onClearErrors'),
  onDone: action('onDone'),
  onKeyChange: action('onKeyChange'),
  onNameChange: action('onNameChange'),
  secretKey: '',
  secretKeyValidationState: 'none',
  waiting: false,
}

const enterKeyProps = {
  ...common,
  view: 'key',
}

const keyErrorProps = {
  ...common,
  keyError: 'Error: invalid key',
  secretKey: 'not a key',
  secretKeyValidationState: 'error',
}

const enterNameProps = {
  ...common,
  view: 'name',
}

const load = () => {
  storiesOf('Wallets/Link existing', module)
    .addDecorator(story => (
      <Box style={platformStyles({common: {minHeight: 525, maxWidth: 360}, isElectron: {height: 525}})}>
        {story()}
      </Box>
    ))
    .add('Enter key', () => <LinkExisting {...enterKeyProps} />)
    .add('Secret key error', () => <LinkExisting {...keyErrorProps} />)
    .add('Enter name', () => <LinkExisting {...enterNameProps} onBack={action('onBack')} />)
}

export default load
