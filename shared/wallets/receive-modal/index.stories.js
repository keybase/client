// @flow
import React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import ReceiveModal from '.'

const load = () => {
  storiesOf('Wallets', module).add('Receive', () => (
    <ReceiveModal
      federatedAddress="cecile*keybase.io"
      onClose={action('onClose')}
      stellarAddress="G23T5671ASCZZX09235678ASQ511U12O91AQ"
      username="cecileb"
    />
  ))
}

export default load
