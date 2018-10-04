// @flow
import React from 'react'
import {Text} from '../common-adapters'
import {storiesOf} from '../stories/storybook'
import asset from './asset/index.stories'
import banner from './banner/index.stories'
import common from './common/index.stories'
import createAccount from './create-account/index.stories'
import linkExisting from './link-existing/index.stories'
import sendForm from './send-form/index.stories'
import confirmForm from './confirm-form/index.stories'
import receiveModal from './receive-modal/index.stories'
import exportSecretKey from './export-secret-key/index.stories'
import transaction from './transaction/index.stories'
import transactionDetails from './transaction-details/index.stories'
import walletList from './wallet-list/index.stories'
import wallet from './wallet/index.stories'

const load = () => {
  // asset()
  // banner()
  // common()
  // createAccount()
  // exportSecretKey()
  // linkExisting()
  // receiveModal()
  sendForm()
  // confirmForm()
  // walletList()
  // wallet()
  // transaction()
  // transactionDetails()

  /* Still TODO */
  storiesOf('Wallets', module).add('Wallet Onboarding', () => (
    <Text type="BodyBig">Wallet Onboarding TBD</Text>
  ))
}

export default load
