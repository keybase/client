import React from 'react'
import * as Sb from '../../stories/storybook'
import ReceiveModal from '.'

const load = () => {
  Sb.storiesOf('Wallets', module)
    .add('Receive to primary', () => (
      <ReceiveModal
        accountName="cecileb's primary account"
        isDefaultAccount={true}
        federatedAddress="cecile*keybase.io"
        onClose={Sb.action('onClose')}
        onRequest={Sb.action('onRequest')}
        stellarAddress="G23T5671ASCZZX09235678ASQ511U12O91AQ"
      />
    ))
    .add('Receive to secondary', () => (
      <ReceiveModal
        accountName="cecileb's secondary account"
        isDefaultAccount={false}
        onClose={Sb.action('onClose')}
        onRequest={Sb.action('onRequest')}
        stellarAddress="G23T5671ASCZZX09235678ASQ511U12O91AQ"
      />
    ))
}

export default load
