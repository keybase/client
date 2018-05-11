// @flow
import React from 'react'
import {Text} from '../common-adapters'
import {storiesOf} from '../stories/storybook'
import asset from './asset/index.stories'
import linkExisting from './link-existing/index.stories'
import sendForm from './send-form/index.stories'
import walletList from './wallet-list/index.stories'
import wallet from './wallet/index.stories'

const load = () => {
  asset()
  linkExisting()
  sendForm()
  walletList()
  wallet()

  /* Still TODO */
  storiesOf('Wallets', module).add('Wallet Onboarding', () => (
    <Text type="BodyBig">Wallet Onboarding TBD</Text>
  ))
  storiesOf('Wallets', module).add('Settings', () => <Text type="BodyBig">Settings TBD</Text>)
  storiesOf('Wallets/Transaction', module).add('Default wallet to Keybase User', () => (
    <Text type="BodyBig">TBD</Text>
  ))
  storiesOf('Wallets/Transaction', module).add('Default wallet to Stellar Public Key', () => (
    <Text type="BodyBig">TBD</Text>
  ))
  storiesOf('Wallets/Transaction', module).add('Anonymous wallet to Keybase User', () => (
    <Text type="BodyBig">TBD</Text>
  ))
  storiesOf('Wallets/Transaction', module).add('Anonymous wallet to Stellar public key', () => (
    <Text type="BodyBig">TBD</Text>
  ))
  storiesOf('Wallets/Transaction', module).add('Pending', () => <Text type="BodyBig">TBD</Text>)
  storiesOf('Wallets/Transaction', module).add('Wallet to Wallet', () => <Text type="BodyBig">TBD</Text>)
}

export default load
