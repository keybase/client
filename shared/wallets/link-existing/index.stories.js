// @flow
import * as React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import {Box} from '../../common-adapters'
import {platformStyles} from '../../styles'
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
  view: 'key',
}

const enterNameProps = {
  ...actions,
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
    .add('Prefilled name', () => <LinkExisting {...enterNameProps} name="mikem's third wallet" />)
}

export default load
