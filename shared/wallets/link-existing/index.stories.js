// @flow
import * as React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import {Box} from '../../common-adapters'
import {platformStyles} from '../../styles'
import LinkExisting from '.'

const common = {
  keyError: '',
  onCancel: action('onCancel'),
  onCheckKey: action('onCheckKey'),
  onCheckName: action('onCheckName'),
  onClearErrors: action('onClearErrors'),
  onDone: action('onDone'),
  onKeyChange: action('onKeyChange'),
  onNameChange: action('onNameChange'),
  onViewChange: action('onViewChange'),
  nameError: '',
  nameValidationState: 'none',
  secretKeyValidationState: 'none',
}

const enterKeyProps = {
  ...common,
  name: '',
  secretKey: '',
  view: 'key',
}

const enterNameProps = {
  ...common,
  name: '',
  secretKey: '',
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
    .add('Enter name', () => <LinkExisting {...enterNameProps} />)
    .add('Prefilled name', () => <LinkExisting {...enterNameProps} name="mikem's third account" />)
}

export default load
