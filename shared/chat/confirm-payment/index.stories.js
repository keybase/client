// @flow
import * as React from 'react'
import {Box} from '../../common-adapters/index'
import * as Sb from '../../stories/storybook'

import PaymentsConfirm from '.'

const props = {
  displayTotal: '$8.94 USD',
  loading: false,
  onAccept: Sb.action('onAccept'),
  onCancel: Sb.action('onCancel'),
  payments: [
    {
      displayAmount: '$1.00 USD',
      fullName: 'Cécile Boucheron',
      username: 'cecileb',
      xlmAmount: '4.4811371 XLM',
    },
    {
      displayAmount: null,
      fullName: 'Patrick Crosby',
      username: 'patrick',
      xlmAmount: '10 XLM',
    },
    {
      displayAmount: '5,00 € EUR',
      fullName: 'Mike Maxim',
      username: 'mikem',
      xlmAmount: '25.5818284 XLM',
    },
    {
      displayAmount: null,
      fullName: 'Max Krohn',
      username: 'max',
      xlmAmount: '14 XLM',
    },
  ],
  xlmTotal: '40.0629655 XLM',
}

const load = () => {
  Sb.storiesOf('Chat/Wallet/Confirm', module)
    .addDecorator(story => <Box style={{maxWidth: 1000, padding: 5}}>{story()}</Box>)
    .add('Loaded', () => <PaymentsConfirm {...props} />)
}

export default load
