// @flow
import React from 'react'
import * as Sb from '../../stories/storybook'
import ReceiveModal from '.'

const load = () => {
  Sb.storiesOf('Wallets', module)
    .add('Receive to primary', () => (
      <ReceiveModal
        federatedAddress="cecile*keybase.io"
        onClose={Sb.action('onClose')}
        stellarAddress="G23T5671ASCZZX09235678ASQ511U12O91AQ"
        username="cecileb"
      />
    ))
    .add('Receive to secondary', () => (
      <ReceiveModal
        onClose={Sb.action('onClose')}
        stellarAddress="G33T5671ASCZZX09235678ASQ511U12O91AQ"
        username="cecileb"
      />
    ))
}

export default load
