// @flow
import * as React from 'react'
import * as Constants from '../../constants/wallets'
import {Box} from '../../common-adapters'
import {action, storiesOf} from '../../stories/storybook'
import {NativeAsset} from '.'

const native = {
  availableToSend: '122.0000000 XLM',
  balance: '123.5000000 XLM',
  displayBalance: '$54.14 USD',
  expanded: false,
  reserves: [
    Constants.makeReserve({amount: '1.0', description: 'account'}),
    Constants.makeReserve({amount: '0.5', description: 'KEYZ/Unknown trust line'}),
  ],
  toggleExpanded: action('toggleExpanded'),
}

const load = () => {
  storiesOf('Stellar/Assets', module)
    .addDecorator(story => <Box style={{width: 400}}>{story()}</Box>)
    .add('Native currency', () => <NativeAsset {...native} />)
}

export default load
