import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import AccountEntry from '.'

const account = {
  contents: '5 XLM',
  keybaseUser: 'nathunsmitty',
  name: 'Primary Account',
}

const load = () => {
  Sb.storiesOf('Wallets/Common/Account Entry', module)
    .add('Default', () => <AccountEntry {...account} />)
    .add('Centered with no wallet icon', () => (
      <AccountEntry {...account} isDefault={true} center={true} showWalletIcon={false} />
    ))
    .add('Centered with short name', () => (
      <AccountEntry
        name="a"
        keybaseUser=""
        contents="5 XLM"
        isDefault={true}
        center={true}
        showWalletIcon={false}
      />
    ))
}

export default load
