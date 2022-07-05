import * as React from 'react'
import {Box} from '../../../common-adapters/index'
import * as Sb from '../../../stories/storybook'

import PaymentsConfirm from '.'

const props = {
  displayTotal: '$8.94 USD',
  loading: false,
  onAccept: Sb.action('onAccept'),
  onCancel: Sb.action('onCancel'),
  onWallet: Sb.action('onWallet'),
  payments: [
    {
      displayAmount: '$1.00 USD',
      fullName: 'Cécile Boucheron',
      username: 'cecileb',
      xlmAmount: '4.4811371 XLM',
    },
    {
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
      error: 'Failed!',
      fullName: 'Max Krohn',
      username: 'max',
      xlmAmount: '',
    },
    {
      fullName: 'Karen Maxim',
      username: 'karenm',
      xlmAmount: '3 XLM',
    },
  ],
  xlmTotal: '40.0629655 XLM',
}

const loadingProps = {
  ...props,
  loading: true,
}

const errorProps = {
  ...props,
  error: 'Failed!',
}

const errorNoWalletProps = {
  ...props,
  error: 'Wallet needed to send money in chat',
  errorIsNoWallet: true,
}

const smallProps = {
  ...props,
  xlmTotal: '1 XLM',
}

const onePaymentProps = {
  ...props,
  payments: [
    {
      displayAmount: '$1.00 USD',
      fullName: 'Cécile Boucheron',
      username: 'cecileb',
      xlmAmount: '4.4811371 XLM',
    },
  ],
}

const load = () => {
  Sb.storiesOf('Chat/Wallet/Confirm', module)
    .addDecorator(story => <Box style={{maxWidth: 1000, padding: 5}}>{story()}</Box>)
    .add('Loaded', () => <PaymentsConfirm {...props} />)
    .add('Loaded (one)', () => <PaymentsConfirm {...onePaymentProps} />)
    .add('Loaded (small total)', () => <PaymentsConfirm {...smallProps} />)
    .add('Loading', () => <PaymentsConfirm {...loadingProps} />)
    .add('Error', () => <PaymentsConfirm {...errorProps} />)
    .add('Error (no wallet)', () => <PaymentsConfirm {...errorNoWalletProps} />)
}

export default load
