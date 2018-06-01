// @flow
import React from 'react'
import {Text} from '../common-adapters'
import {storiesOf} from '../stories/storybook'
import asset from './asset/index.stories'
import linkExisting from './link-existing/index.stories'
import sendForm from './send-form/index.stories'
import transaction from './transaction/index.stories'
import transactionDetails from './transaction-details/index.stories'

import walletList from './wallet-list/index.stories'
import wallet from './wallet/index.stories'

const load = () => {
  asset()
  linkExisting()
  sendForm()
  walletList()
  wallet()
  transaction()
  transactionDetails()

  /* Still TODO */
  storiesOf('Wallets', module).add('Wallet Onboarding', () => (
    <Text type="BodyBig">Wallet Onboarding TBD</Text>
  ))
  storiesOf('Wallets', module).add('Settings', () => <Text type="BodyBig">Settings TBD</Text>)
}

export default load
