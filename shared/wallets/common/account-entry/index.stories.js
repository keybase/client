// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import AccountEntry from '.'

const account = {
  name: 'Primary Account',
  keybaseUser: 'nathunsmitty',
  contents: '5 XLM',
}

const load = () => {
  Sb.storiesOf('Wallets/Common/Participants Row', module)
    .add('Default', () => <AccountEntry {...account} />)
    .add('Centered with no wallet icon', () => (
      <AccountEntry {...account} center={true} showWalletIcon={false} />
    ))
}

export default load
