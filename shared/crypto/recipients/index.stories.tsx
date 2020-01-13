import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Recipients from '.'

const onClearRecipients = Sb.action('onClearRecipients')
const onAddRecipients = Sb.action('onAddRecipients')

const noUsers = []
const oneUser = ['cecileb']
const muiltipleUsers = ['chris', 'cecileb', 'cdixon', 'max']

const load = () => {
  Sb.storiesOf('Crypto/Recipients', module)
    .add('Empty', () => (
      <Recipients
        recipients={noUsers}
        onClearRecipients={onClearRecipients}
        onAddRecipients={onAddRecipients}
      />
    ))
    .add('Single User', () => (
      <Recipients
        recipients={oneUser}
        onClearRecipients={onClearRecipients}
        onAddRecipients={onAddRecipients}
      />
    ))
    .add('Multiple Users', () => (
      <Recipients
        recipients={muiltipleUsers}
        onClearRecipients={onClearRecipients}
        onAddRecipients={onAddRecipients}
      />
    ))
}

export default load
